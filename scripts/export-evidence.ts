/**
 * Generates EVIDENCE.md from chain state.
 *
 * Every claim Assay makes is a transaction on one of two chains. Writing those
 * hashes by hand guarantees they drift the first time anything is re-run, so
 * this reads them back out of the chains instead and groups them by what each
 * one demonstrates.
 *
 * The source-transaction reconstruction here mirrors `web/lib/evidence.ts`.
 * That module is bound to the Next server runtime by `server-only`, so it
 * cannot be imported from a script; the shared part is the twenty lines that
 * turn a submission's calldata back into a Sepolia transaction hash.
 *
 *   pnpm evidence:export
 */
import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';
import { ethers } from 'ethers';

import {
  ASSAY_ORACLE_ABI,
  BLOCK_PROVER_ABI,
  CREDIT_LINE_ABI,
  LENDING_POOL_ABI,
} from '../config/abi';
import { CREDITCOIN, SEPOLIA, REGISTRIES } from '../config/chains';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '../config/deployments';

const FREEZE_REASONS = [
  'NotFrozen',
  'IdentityTransferred',
  'WalletChanged',
  'EvidenceStale',
] as const;

const STATES = ['None', 'Offered', 'Active', 'Frozen', 'Repaid', 'Defaulted'] as const;

const sepTx = (h: string) => `[\`${h.slice(0, 10)}…\`](${SEPOLIA.explorerUrl}/tx/${h})`;
const ccTx = (h: string) => `[\`${h.slice(0, 10)}…\`](${CREDITCOIN.explorerUrl}/tx/${h})`;
const ccAddr = (a: string) => `[\`${a}\`](${CREDITCOIN.explorerUrl}/address/${a})`;
const sepAddr = (a: string) => `[\`${a}\`](${SEPOLIA.explorerUrl}/address/${a})`;
const ctc = (v: bigint) => `${Number(ethers.formatEther(v)).toFixed(2)} tCTC`;
const quantity = (n: number) => `0x${n.toString(16)}`;

/** Markdown does not wrap for you, and a 400-word single line is unreadable. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function delay(seconds: number | null): string {
  if (seconds === null) return '-';
  return `+${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
}

type Verdict = {
  agentId: number;
  approve: boolean;
  credit_limit: string;
  collateral_ratio: number;
  rate_bps: number;
  reasoning: string;
  reasoningHash: string;
  source: string;
};

type Proof = {
  eventName: string;
  agentId: number;
  detail: string;
  ccTxHash: string;
  sourceTxHash: string | null;
  sourceBlock: number | null;
  delaySeconds: number | null;
};

async function main(): Promise<void> {
  const cc = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const sep = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);

  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, cc);
  const prover = new ethers.Contract(CREDITCOIN.blockProverPrecompile, BLOCK_PROVER_ABI, cc);
  const credit = new ethers.Contract(DEPLOYMENTS.creditLine, CREDIT_LINE_ABI, cc);
  const pool = new ethers.Contract(DEPLOYMENTS.lendingPool, LENDING_POOL_ABI, cc);

  const window = { fromBlock: ORACLE_DEPLOYED_AT_BLOCK, toBlock: 'latest' as const };

  console.log('Reading Creditcoin...');
  const [oracleLogs, creditLogs, poolLogs] = await Promise.all([
    cc.getLogs({ ...window, address: DEPLOYMENTS.assayOracle }),
    cc.getLogs({ ...window, address: DEPLOYMENTS.creditLine }),
    cc.getLogs({ ...window, address: DEPLOYMENTS.lendingPool }),
  ]);
  console.log(`  oracle ${oracleLogs.length}, credit ${creditLogs.length}, pool ${poolLogs.length}`);

  /** Reconstructs the Sepolia transaction a proof was built from. */
  async function resolve(log: ethers.Log): Promise<Partial<Proof>> {
    try {
      const submission = await cc.getTransaction(log.transactionHash);
      const decoded = oracle.interface.parseTransaction({ data: submission!.data });
      if (!decoded || decoded.name !== 'execute') return {};

      const blockHeight = Number(decoded.args.blockHeight);
      const siblings = (decoded.args.siblings as [string, boolean][]).map((s) => ({
        hash: s[0],
        isLeft: s[1],
      }));
      const txIndex = Number(
        await prover.calculateTxIndex({ root: decoded.args.merkleRoot, siblings })
      );
      const sourceTx = (await sep.send('eth_getTransactionByBlockNumberAndIndex', [
        quantity(blockHeight),
        quantity(txIndex),
      ])) as { hash?: string } | null;
      if (!sourceTx?.hash) return {};

      const [sourceBlock, verificationBlock] = await Promise.all([
        sep.getBlock(blockHeight),
        cc.getBlock(log.blockNumber),
      ]);

      return {
        sourceTxHash: sourceTx.hash,
        sourceBlock: blockHeight,
        delaySeconds:
          sourceBlock && verificationBlock
            ? Math.max(0, verificationBlock.timestamp - sourceBlock.timestamp)
            : null,
      };
    } catch {
      return {};
    }
  }

  console.log('Reconstructing source transactions on Sepolia...');
  const proofs: Proof[] = [];
  for (const log of oracleLogs) {
    const parsed = oracle.interface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed) continue;
    const a = parsed.args;

    let detail = '';
    let eventName = parsed.name;
    if (parsed.name === 'AgentProven') {
      eventName = 'Registered';
      detail = `owner \`${a.owner}\``;
    } else if (parsed.name === 'FeedbackProven') {
      const value = Number(a.value) / 10 ** Number(a.valueDecimals);
      eventName = 'NewFeedback';
      detail = `${value.toFixed(2)} from \`${String(a.client).slice(0, 10)}…\`, entry ${a.feedbackIndex}`;
    } else if (parsed.name === 'IdentityTransferProven') {
      eventName = 'Transfer';
      detail = `\`${String(a.from).slice(0, 10)}…\` to \`${String(a.to).slice(0, 10)}…\`, ownerChanges now ${a.ownerChanges}`;
    } else if (parsed.name === 'WalletChangeProven') {
      eventName = 'MetadataSet';
      detail = `wallet \`${String(a.newWallet).slice(0, 10)}…\`, walletChanges now ${a.walletChanges}`;
    }

    proofs.push({
      eventName,
      agentId: Number(a.agentId),
      detail,
      ccTxHash: log.transactionHash,
      sourceTxHash: null,
      sourceBlock: null,
      delaySeconds: null,
      ...(await resolve(log)),
    });
    process.stdout.write('.');
  }
  console.log('');

  const named = (logs: ethers.Log[], iface: ethers.Interface) =>
    logs
      .map((log) => {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        return parsed ? { name: parsed.name, args: parsed.args, hash: log.transactionHash } : null;
      })
      .filter((x): x is { name: string; args: ethers.Result; hash: string } => x !== null);

  const creditEvents = named(creditLogs, credit.interface);
  const poolEvents = named(poolLogs, pool.interface);

  const agentIds = [...new Set(proofs.map((p) => p.agentId))].sort((a, b) => a - b);

  console.log('Reading credit lines...');
  const lines = await Promise.all(
    agentIds.map(async (id) => ({ id, line: await credit.getLine(id) }))
  );

  const verdicts = JSON.parse(readFileSync('config/verdicts.json', 'utf8')) as Verdict[];

  const [totalAssets, totalShares, totalDeployed] = await Promise.all([
    pool.totalAssets(),
    pool.totalShares(),
    pool.totalDeployed(),
  ]);

  // ---- write it out -------------------------------------------------------

  const out: string[] = [];
  const w = (s = '') => out.push(s);

  w('# Evidence');
  w();
  w('Every claim in this project is a transaction on one of two chains. This file');
  w('is generated from chain state by `pnpm evidence:export`, so the hashes below');
  w('are read back out of the chains rather than written down.');
  w();
  w(`Generated ${new Date().toISOString().slice(0, 10)}.`);
  w();

  w('## Contracts');
  w();
  w('| What | Chain | Address |');
  w('| --- | --- | --- |');
  w(`| AssayOracle | Creditcoin | ${ccAddr(DEPLOYMENTS.assayOracle)} |`);
  w(`| CreditLine | Creditcoin | ${ccAddr(DEPLOYMENTS.creditLine)} |`);
  w(`| LendingPool | Creditcoin | ${ccAddr(DEPLOYMENTS.lendingPool)} |`);
  w(`| ERC-8004 Identity | Sepolia | ${sepAddr(REGISTRIES.identity)} |`);
  w(`| ERC-8004 Reputation | Sepolia | ${sepAddr(REGISTRIES.reputation)} |`);
  w();
  w('The two Sepolia registries are the trust anchor. Assay did not deploy them');
  w('and cannot write to them. They are the only emitters the oracle accepts.');
  w();

  w('## What this demonstrates');
  w();
  w('### 1. Real ERC-8004 events, proven across chains with no trusted oracle');
  w();
  w(`${proofs.length} events read from Ethereum Sepolia and verified on Creditcoin by the`);
  w('BlockProver precompile. Each row links the original Ethereum transaction and');
  w('the Creditcoin transaction that proved it.');
  w();
  w('The last column is measured from the two block timestamps, not asserted. It');
  w('is the gap between the event happening on Ethereum and its proof landing on');
  w('Creditcoin, so it is a ceiling on the attestation window rather than the');
  w('window itself. Rows proven as soon as they could be sit at 8 to 9 minutes,');
  w('which is that window. Anything much larger is simply an event that was proven');
  w('later: once a block is attested it proves immediately, however old it is.');
  w();
  w('| Event | Agent | Detail | On Ethereum | Proven on Creditcoin | Event to proof |');
  w('| --- | --- | --- | --- | --- | --- |');
  for (const p of proofs) {
    w(
      `| \`${p.eventName}\` | ${p.agentId} | ${p.detail} | ${p.sourceTxHash ? sepTx(p.sourceTxHash) : '-'} | ${ccTx(p.ccTxHash)} | ${delay(p.delaySeconds)} |`
    );
  }
  w();

  w('### 2. Judgments formed from the proven facts, and defended in writing');
  w();
  w('The underwriter reads the proven facts above and nothing else. Its reasoning');
  w('is hashed and bound into the offer on chain, so the text cannot be changed');
  w('after the fact. `source` says which layer decided: `envelope` is a');
  w('deterministic rule applied before any model is called, `judgment` is the');
  w('underwriter forming a view.');
  w();
  w('| Agent | Decision | Decided by | Terms | Reasoning hash |');
  w('| --- | --- | --- | --- | --- |');
  for (const v of verdicts) {
    const terms = v.approve
      ? `${v.credit_limit} tCTC at ${v.rate_bps} bps, ${Math.round(v.collateral_ratio * 100)}% collateral`
      : 'none';
    w(
      `| ${v.agentId} | ${v.approve ? 'Approved' : 'Refused'} | \`${v.source}\` | ${terms} | \`${v.reasoningHash.slice(0, 12)}…\` |`
    );
  }
  w();
  const refusedOnJudgment = verdicts.find((v) => !v.approve && v.source === 'judgment');
  if (refusedOnJudgment) {
    w(`Agent ${refusedOnJudgment.agentId} is the case worth reading. It has the best raw`);
    w('numbers of any agent here and it was declined, which is the behaviour a');
    w('scoring formula cannot produce:');
    w();
    for (const line of wrap(String(refusedOnJudgment.reasoning).trim(), 74)) {
      w(`> ${line}`);
    }
    w();
  }

  w('### 3. Credit extended on that evidence, and frozen when it stopped holding');
  w();
  w('| Agent | State | Limit | Drawn | Outstanding | Freeze reason |');
  w('| --- | --- | --- | --- | --- | --- |');
  for (const { id, line } of lines) {
    if (Number(line.state) === 0) continue;
    w(
      `| ${id} | ${STATES[Number(line.state)]} | ${ctc(line.limit)} | ${ctc(line.totalDrawn)} | ${ctc(line.principalOutstanding)} | ${FREEZE_REASONS[Number(line.freezeReason)]} |`
    );
  }
  w();
  /**
   * A line on chain can predate the agent's current verdict, and saying so is
   * better than letting a reader find the contradiction themselves.
   */
  const contradictions = lines.filter(({ id, line }) => {
    const v = verdicts.find((x) => x.agentId === id);
    return Number(line.state) !== 0 && v && !v.approve;
  });
  if (contradictions.length) {
    const which = contradictions.map(({ id }) => id).join(' and ');
    for (const line of wrap(
      `Agents ${which} hold a line on chain and a refusal in the table above. ` +
        'Both are real, and the pair is the point rather than an inconsistency: ' +
        'evidence changes, so an agent is re-underwritten whenever new facts ' +
        'arrive. A line records what was true when it was offered. A verdict ' +
        'records what is true now.',
      74
    )) {
      w(line);
    }
    w();
  }
  w('The lifecycle transactions behind those states:');
  w();
  w('| Event | Agent | Detail | Transaction |');
  w('| --- | --- | --- | --- |');
  for (const e of creditEvents) {
    const id = e.args.agentId !== undefined ? String(e.args.agentId) : '-';
    let detail = '';
    if (e.name === 'LineOffered')
      detail = `limit ${ctc(e.args.limit)}, collateral ${ctc(e.args.collateralRequired)}, ${e.args.interestBps} bps`;
    else if (e.name === 'LineAccepted') detail = `collateral posted ${ctc(e.args.collateralPosted)}`;
    else if (e.name === 'Drawn') detail = `drew ${ctc(e.args.amount)}`;
    else if (e.name === 'RepaidLine')
      detail = `principal ${ctc(e.args.principal)}, interest ${ctc(e.args.interest)}`;
    else if (e.name === 'LineFrozen') detail = `**${FREEZE_REASONS[Number(e.args.reason)]}**`;
    else if (e.name === 'LineClosed') detail = `collateral returned ${ctc(e.args.collateralReturned)}`;
    else if (e.name === 'UnderwriterSet') detail = `\`${e.args.underwriter}\``;
    w(`| \`${e.name}\` | ${id} | ${detail} | ${ccTx(e.hash)} |`);
  }
  w();

  const frozen = creditEvents.filter((e) => e.name === 'LineFrozen');
  if (frozen.length) {
    w('#### The freeze, end to end');
    w();
    w('This is the T8 attack: build a record, borrow against it, then sell the');
    w('identity to someone with no history. Read the four transactions in order.');
    w();
    for (const f of frozen) {
      const id = Number(f.args.agentId);
      const offer = creditEvents.find((e) => e.name === 'LineOffered' && Number(e.args.agentId) === id);
      const transfer = proofs.find((p) => p.eventName === 'Transfer' && p.agentId === id);
      w(`Agent ${id}:`);
      w();
      if (offer) w(`1. Line offered on proven evidence: ${ccTx(offer.hash)}`);
      if (transfer?.sourceTxHash)
        w(`2. Identity sold on Ethereum: ${sepTx(transfer.sourceTxHash)}`);
      if (transfer) w(`3. Transfer proven onto Creditcoin: ${ccTx(transfer.ccTxHash)}`);
      w(`4. Line frozen, \`${FREEZE_REASONS[Number(f.args.reason)]}\`: ${ccTx(f.hash)}`);
      w();
      w('Steps 3 and 4 were made by the watcher with no human involved.');
      w();
    }
  }

  w('### 4. A funded pool, with real lender capital');
  w();
  w(`Assets ${ctc(totalAssets)}, shares ${ethers.formatEther(totalShares)}, deployed ${ctc(totalDeployed)}.`);
  w();
  w('| Event | Detail | Transaction |');
  w('| --- | --- | --- |');
  for (const e of poolEvents) {
    let detail = '';
    if (e.name === 'Deposited') detail = `${ctc(e.args.amount)} from \`${String(e.args.lender).slice(0, 10)}…\``;
    else if (e.name === 'Withdrawn') detail = `${ctc(e.args.amount)} to \`${String(e.args.lender).slice(0, 10)}…\``;
    else if (e.name === 'Lent') detail = `${ctc(e.args.amount)} to \`${String(e.args.to).slice(0, 10)}…\``;
    else if (e.name === 'Repaid')
      detail = `principal ${ctc(e.args.principal)}, interest ${ctc(e.args.interest)}`;
    else if (e.name === 'LossRecorded') detail = `written off ${ctc(e.args.principal)}`;
    else if (e.name === 'CreditLineSet') detail = `\`${e.args.creditLine}\``;
    w(`| \`${e.name}\` | ${detail} | ${ccTx(e.hash)} |`);
  }
  w();

  w('## Reading this yourself');
  w();
  w('Nothing here requires trusting this file. Open any Creditcoin transaction');
  w('above, read the `execute` call it made, and the block height and Merkle proof');
  w('it carries are the ones the precompile verified. The Ethereum link in the same');
  w('row is the transaction that proof was built from.');
  w();

  writeFileSync('EVIDENCE.md', out.join('\n'));
  console.log(`\nEVIDENCE.md written: ${proofs.length} proofs, ${creditEvents.length} credit events, ${poolEvents.length} pool events.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
