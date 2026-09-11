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

  let unresolved = 0;

  /**
   * Retries the transient failures these endpoints produce under load.
   *
   * A throttled request is not a missing fact. Without this, ten of twenty-one
   * proofs silently lost their Ethereum link and rendered as dashes, which
   * reads as evidence that does not exist rather than evidence we failed to
   * fetch. That is the worst possible way for this file to be wrong.
   */
  async function resilient<T>(run: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await run();
      } catch (error) {
        last = error;
        const message = (error as Error).message ?? '';
        const transient =
          message.includes('-32005') ||
          message.includes('Too Many Requests') ||
          message.includes('timeout') ||
          message.includes('missing response') ||
          message.includes('SERVER_ERROR');
        if (!transient) throw error;
        await new Promise((r) => setTimeout(r, 1_500 * (attempt + 1)));
      }
    }
    throw last;
  }

  /** Reconstructs the Sepolia transaction a proof was built from. */
  async function resolve(log: ethers.Log): Promise<Partial<Proof>> {
    try {
      const submission = await resilient(() => cc.getTransaction(log.transactionHash));
      const decoded = oracle.interface.parseTransaction({ data: submission!.data });
      if (!decoded || decoded.name !== 'execute') return {};

      const blockHeight = Number(decoded.args.blockHeight);
      const siblings = (decoded.args.siblings as [string, boolean][]).map((s) => ({
        hash: s[0],
        isLeft: s[1],
      }));
      const txIndex = Number(
        await resilient(() => prover.calculateTxIndex({ root: decoded.args.merkleRoot, siblings }))
      );
      const sourceTx = (await resilient(() =>
        sep.send('eth_getTransactionByBlockNumberAndIndex', [
          quantity(blockHeight),
          quantity(txIndex),
        ])
      )) as { hash?: string } | null;
      if (!sourceTx?.hash) return {};

      const [sourceBlock, verificationBlock] = await Promise.all([
        resilient(() => sep.getBlock(blockHeight)),
        resilient(() => cc.getBlock(log.blockNumber)),
      ]);

      return {
        sourceTxHash: sourceTx.hash,
        sourceBlock: blockHeight,
        delaySeconds:
          sourceBlock && verificationBlock
            ? Math.max(0, verificationBlock.timestamp - sourceBlock.timestamp)
            : null,
      };
    } catch (error) {
      unresolved++;
      console.warn(
        `\n  could not resolve the source for ${log.transactionHash.slice(0, 12)}…: ${(error as Error).message.slice(0, 90)}`
      );
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
  /** Prose, wrapped. Long unwrapped lines are the main thing that makes a generated file unreadable. */
  const para = (text: string) => {
    for (const line of wrap(text, 74)) w(line);
    w();
  };

  const verdictFor = (id: number) => verdicts.find((v) => v.agentId === id);
  const lineFor = (id: number) => lines.find((l) => l.id === id)?.line;
  const proofsFor = (id: number) => proofs.filter((p) => p.agentId === id);
  const creditFor = (id: number) =>
    creditEvents.filter((e) => e.args.agentId !== undefined && Number(e.args.agentId) === id);

  /**
   * A representative excerpt: enough sentences to carry the actual reason.
   * One is not always enough, because a rule-based refusal opens by saying it
   * is a rule-based refusal and only then says why.
   */
  const excerpt = (text: string) => {
    const sentences = text.trim().split(/(?<=\.)\s+/);
    const taken: string[] = [];
    for (const sentence of sentences) {
      taken.push(sentence);
      if (taken.join(' ').length > 200) break;
    }
    return taken.join(' ');
  };

  w('# Evidence');
  w();
  para(
    'Assay makes claims about software agents: that one has a real work history, ' +
      'that another faked its ratings, that a third sold its identity after ' +
      'borrowing. Every one of those claims is a transaction on a public chain. ' +
      'This file lists them so you can check any of it yourself.'
  );
  para(
    `Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm evidence:export\`, ` +
      'which reads both chains live. The hashes below were not typed in.'
  );

  w('## How to read this');
  w();
  para('Two chains are involved, and everything moves in one direction between them.');
  w(
    `- **Ethereum Sepolia** holds the agents' work history, in two ERC-8004 registries that Assay did not deploy and cannot write to. Links to it go to Etherscan.`
  );
  w(
    `- **Creditcoin** is where that history gets proven, and where the lending happens. Links to it go to Blockscout.`
  );
  w();
  para(
    'A fact happens on Ethereum. It is then proven onto Creditcoin, meaning ' +
      'Creditcoin verified for itself that the Ethereum transaction really ' +
      'happened and really succeeded. No middleman reports it, and no one is ' +
      'asked to take anyone at their word. So most things below have two links: ' +
      'the original event, and its proof.'
  );

  w('## The short version');
  w();
  para('Five agents appear here. This is what happened to each of them.');
  w('| Agent | What it is | How it ended |');
  w('| --- | --- | --- |');

  type Story = { id: number; headline: string; what: string; ending: string };

  const feedbackFor = (id: number) =>
    proofs.filter((p) => p.agentId === id && p.eventName === 'NewFeedback').length;

  /** Among judgment refusals, the one that actually had the strongest record. */
  const bestNumbersRefused = agentIds
    .filter((id) => {
      const v = verdictFor(id);
      return v && !v.approve && v.source === 'judgment';
    })
    .sort((a, b) => feedbackFor(b) - feedbackFor(a))[0];

  const stories: Story[] = agentIds.map((id): Story => {
    const v = verdictFor(id);
    const line = lineFor(id);
    const state = line ? Number(line.state) : 0;
    const feedback = proofsFor(id).filter((p) => p.eventName === 'NewFeedback');
    const raters = new Set(feedback.map((f) => f.detail.split('`')[1])).size;

    if (state === 3) {
      return {
        id,
        headline: 'approved, then frozen when its identity was sold',
        what: `${feedback.length} ratings from ${raters} different clients`,
        ending: '**Frozen.** Its identity was sold after it borrowed',
      };
    }
    if (state === 4) {
      return {
        id,
        headline: 'borrowed and repaid in full',
        what: 'the first line Assay ever opened',
        ending: '**Repaid.** Principal and interest returned, collateral released',
      };
    }
    if (state === 2) {
      return {
        id,
        headline: 'approved, and currently borrowing',
        what: `${feedback.length} ratings from ${raters} different clients`,
        ending: '**Active.** Drew against its line and still owes it',
      };
    }
    if (v && !v.approve && v.source === 'judgment') {
      const concentrated = raters <= 1;
      return {
        id,
        // Only one agent can have had the best numbers. Giving every judgment
        // refusal that headline pointed the reader at whichever sorted first.
        headline:
          id === bestNumbersRefused
            ? 'refused, despite having the best numbers here'
            : 'refused on judgment, with a usable but thin record',
        what: concentrated
          ? feedback.length === 1
            ? '1 rating, from a single client'
            : `${feedback.length} ratings, all from the same client`
          : `${feedback.length} ratings from ${raters} clients`,
        ending: '**Refused.** No credit offered',
      };
    }
    if (v && !v.approve) {
      return {
        id,
        headline: 'refused before the underwriter was called',
        what: 'no usable history',
        ending: '**Refused.** Declined by rule, no judgment needed',
      };
    }
    // An agent with a record but no verdict has applied and is waiting, which is
    // a different thing from one that only ever rated others. Calling both
    // "a client" mislabelled the outside applicant as a bystander.
    if (feedback.length > 0) {
      return {
        id,
        headline: 'joined on its own, and is building a record',
        what: `${feedback.length} rating${feedback.length === 1 ? '' : 's'} from ${raters} client${raters === 1 ? '' : 's'}`,
        ending: 'Proven, not yet underwritten',
      };
    }
    return {
      id,
      headline: 'a client, not a borrower',
      what: 'registered so it could rate other agents',
      ending: 'Never applied for credit',
    };
  });

  for (const s of stories) {
    w(`| [${s.id}](#agent-${s.id}) | ${s.what} | ${s.ending} |`);
  }
  w();
  const highlight = stories.find((s) => s.headline.startsWith('refused, despite'));
  if (highlight) {
    para(
      `If you only read one part of this file, read agent ${highlight.id}. It has the ` +
        'best raw numbers of anything here and it was turned down, which is the ' +
        'whole reason this project sits in the AI track rather than the DeFi one.'
    );
  }

  w('## Agent by agent');
  w();
  para('Each of these reads in order, from the agent appearing on Ethereum to whatever happened to its credit.');

  for (const s of stories) {
    const id = s.id;
    const v = verdictFor(id);
    const line = lineFor(id);
    const mine = proofsFor(id);
    const credit = creditFor(id);

    w(`### Agent ${id}`);
    w();
    w(`*${s.headline[0].toUpperCase()}${s.headline.slice(1)}.*`);
    w();

    let step = 1;

    const registered = mine.find((p) => p.eventName === 'Registered');
    if (registered) {
      w(
        `**${step++}. It registered an identity on Ethereum.** ${registered.detail.replace('owner ', 'Owned by ')}.`
      );
      w();
      w(
        `${registered.sourceTxHash ? sepTx(registered.sourceTxHash) : 'source not resolved'} on Ethereum, proven on Creditcoin at ${ccTx(registered.ccTxHash)}.`
      );
      w();
    }

    const feedback = mine.filter((p) => p.eventName === 'NewFeedback');
    if (feedback.length) {
      const raters = [...new Set(feedback.map((f) => f.detail.split('`')[1]))];
      w(
        `**${step++}. It was rated ${feedback.length} time${feedback.length === 1 ? '' : 's'} by ${raters.length} client${raters.length === 1 ? '' : 's'}.**`
      );
      w();
      if (raters.length === 1) {
        para(
          `Every rating came from the same address. Anyone can leave feedback ` +
            `on any agent, so a run of high scores from one source is close to ` +
            `worthless, and the underwriter is expected to notice.`
        );
      }
      w('| Score | From | On Ethereum | Proven on Creditcoin |');
      w('| --- | --- | --- | --- |');
      for (const f of feedback) {
        const [score, rest] = f.detail.split(' from ');
        w(
          `| ${score} | \`${rest?.split('`')[1] ?? '?'}\` | ${f.sourceTxHash ? sepTx(f.sourceTxHash) : '-'} | ${ccTx(f.ccTxHash)} |`
        );
      }
      w();
    }

    const offer = credit.find((e) => e.name === 'LineOffered');

    /**
     * Where the verdict belongs in the story.
     *
     * A verdict is the agent's judgment as it stands now, while a line records
     * what was true when it was offered. For an agent whose line came first and
     * whose current answer is a refusal, telling it in file order would read as
     * "declined, then given credit anyway". It is told last instead, as what it
     * actually is: the system changing its mind after the facts moved.
     */
    const rejudged = Boolean(v && !v.approve && offer);

    const writeVerdict = () => {
      if (!v) return;
      if (rejudged) {
        w(`**${step++}. The underwriter has since changed its mind.**`);
        w();
        para(
          'Evidence moved after this line was opened, so the agent was judged ' +
            'again from the new facts. It would not be approved today.'
        );
      } else {
        w(
          `**${step++}. The underwriter ${v.approve ? 'approved it' : 'turned it down'}.**` +
            (v.source === 'envelope'
              ? ' Decided by a fixed rule before any model was consulted, because the evidence was unusable.'
              : ' A judgment, formed by reading the proven facts above and nothing else.')
        );
        w();
      }
      for (const line of wrap(excerpt(v.reasoning), 74)) w(`> ${line}`);
      w();
      para(
        `Its full reasoning is in the appendix. That text is hashed as ` +
          `\`${v.reasoningHash.slice(0, 12)}…\` and bound into the decision on chain, so ` +
          `it cannot be quietly rewritten afterwards.`
      );
    };

    if (!rejudged) writeVerdict();

    const accept = credit.find((e) => e.name === 'LineAccepted');
    const drawn = credit.filter((e) => e.name === 'Drawn');
    if (offer) {
      w(
        `**${step++}. A credit line was opened.** ${ctc(offer.args.limit)} limit at ${offer.args.interestBps} bps, against ${ctc(offer.args.collateralRequired)} of collateral.`
      );
      w();
      w(`Offered ${ccTx(offer.hash)}${accept ? `, accepted ${ccTx(accept.hash)}` : ''}.`);
      w();
    }
    if (drawn.length) {
      w(
        `**${step++}. It drew on the line.** ${drawn.map((d) => `${ctc(d.args.amount)} at ${ccTx(d.hash)}`).join(', ')}.`
      );
      w();
      para('That money came out of the lending pool, which real deposits funded.');
    }

    const transfer = mine.find((p) => p.eventName === 'Transfer');
    const frozen = credit.find((e) => e.name === 'LineFrozen');
    if (transfer) {
      w(`**${step++}. Its identity was sold on Ethereum.** ${transfer.detail}.`);
      w();
      para(
        `This is the attack the system exists to catch: build a record, borrow ` +
          `against it, then hand the identity to someone with no history at all. ` +
          `The evidence that earned the credit no longer describes whoever now ` +
          `holds it.`
      );
      w(
        `Sold ${transfer.sourceTxHash ? sepTx(transfer.sourceTxHash) : '-'}, proven onto Creditcoin ${ccTx(transfer.ccTxHash)}.`
      );
      w();
    }
    if (frozen) {
      w(
        `**${step++}. The credit line froze itself.** Reason recorded on chain: \`${FREEZE_REASONS[Number(frozen.args.reason)]}\`.`
      );
      w();
      w(`${ccTx(frozen.hash)}`);
      w();
      para(
        'No human was involved in the previous step or this one. The watcher ' +
          'noticed the sale, proved it, and froze the line on its own.'
      );
    }

    const repaid = credit.find((e) => e.name === 'RepaidLine');
    const closed = credit.find((e) => e.name === 'LineClosed');
    if (repaid) {
      w(
        `**${step++}. It repaid.** ${ctc(repaid.args.principal)} of principal plus ${ctc(repaid.args.interest)} of interest.`
      );
      w();
      w(
        `${ccTx(repaid.hash)}${closed ? `, and ${ctc(closed.args.collateralReturned)} of collateral came back at close.` : '.'}`
      );
      w();
    }

    if (rejudged) writeVerdict();

    /**
     * An agent that only ever rated others still matters: a rating from a party
     * holding its own proven identity is worth more than one from a bare
     * address, and that is most of why anyone here was approved at all.
     */
    if (!v && !offer && registered) {
      const ownerPrefix = String(registered.detail).split('`')[1]?.slice(0, 10);
      const left = proofs.filter(
        (x) => x.eventName === 'NewFeedback' && x.detail.includes(ownerPrefix ?? '\u0000')
      );
      if (left.length) {
        w(
          `**2. It rated other agents ${left.length} time${left.length === 1 ? '' : 's'}.** ` +
            `Agents ${[...new Set(left.map((x) => x.agentId))].join(' and ')}.`
        );
        w();
        para(
          'This is why it appears at all. Feedback is permissionless, so a rating ' +
            'is only worth as much as whoever left it: one from a party holding ' +
            'its own registered identity carries weight that one from a bare ' +
            'address does not.'
        );
      }
    }

    if (line && Number(line.state) !== 0) {
      w(
        `**Where it stands now:** ${STATES[Number(line.state)]}, ${ctc(line.principalOutstanding)} outstanding of a ${ctc(line.limit)} limit.`
      );
      w();
    }
  }

  const stale = lines.filter(({ id, line }) => {
    const v = verdictFor(id);
    return Number(line.state) !== 0 && v && !v.approve;
  });
  if (stale.length) {
    w('### Why two agents show both a line and a refusal');
    w();
    para(
      `Agents ${stale.map(({ id }) => id).join(' and ')} hold a credit line on chain and a ` +
        'refusal from the underwriter. Both are true, and the pair is the point ' +
        'rather than a contradiction.'
    );
    para(
      'Evidence changes. An agent is re-judged whenever new facts arrive, so a ' +
        'line records what was true when it was offered, and a verdict records ' +
        'what is true now. One of these two sold its identity; the other ran out ' +
        'of fresh evidence. Neither would be approved again today.'
    );
  }

  w('## The lending pool');
  w();
  para(
    `Lenders put real money in and the agents borrowed it. The pool currently holds ` +
      `${ctc(totalAssets)} against ${ethers.formatEther(totalShares)} shares, with ${ctc(totalDeployed)} out on loan. ` +
      `It is worth more than was deposited because a borrower repaid with interest.`
  );
  w('| What happened | Detail | Transaction |');
  w('| --- | --- | --- |');
  for (const e of poolEvents) {
    let label = e.name as string;
    let detail = '';
    if (e.name === 'Deposited') {
      label = 'A lender deposited';
      detail = `${ctc(e.args.amount)} from \`${String(e.args.lender).slice(0, 10)}…\``;
    } else if (e.name === 'Withdrawn') {
      label = 'A lender withdrew';
      detail = `${ctc(e.args.amount)} to \`${String(e.args.lender).slice(0, 10)}…\``;
    } else if (e.name === 'Lent') {
      label = 'Lent to an agent';
      detail = `${ctc(e.args.amount)} to \`${String(e.args.to).slice(0, 10)}…\``;
    } else if (e.name === 'Repaid') {
      label = 'An agent repaid';
      detail = `${ctc(e.args.principal)} principal, ${ctc(e.args.interest)} interest`;
    } else if (e.name === 'LossRecorded') {
      label = 'A loss was written off';
      detail = ctc(e.args.principal);
    } else if (e.name === 'CreditLineSet') {
      label = 'Pool wired to the credit contract';
      detail = `\`${e.args.creditLine}\``;
    }
    w(`| ${label} | ${detail} | ${ccTx(e.hash)} |`);
  }
  w();

  w('## Appendix');
  w();

  w('### What the underwriter wrote, in full');
  w();
  para(
    'Each of these was hashed and bound into its decision on chain. The site ' +
      'recomputes the hash in your browser, so the text you read is provably the ' +
      'text the contract was given.'
  );
  for (const v of verdicts) {
    w(`**Agent ${v.agentId}, ${v.approve ? 'approved' : 'refused'}** (\`${v.reasoningHash}\`)`);
    w();
    for (const line of wrap(String(v.reasoning).trim(), 74)) w(`> ${line}`);
    w();
  }

  w('### Every proven fact');
  w();
  para(
    `All ${proofs.length} of them, newest last. The final column is measured from the two ` +
      'block timestamps rather than asserted: it is the gap between an event ' +
      'happening on Ethereum and its proof landing on Creditcoin. Rows proven as ' +
      'soon as they could be sit at 8 to 9 minutes, which is the attestation ' +
      'window. Anything much larger is just an event that was proven later, since ' +
      'an already-attested block proves immediately however old it is.'
  );
  w('| Event | Agent | Detail | On Ethereum | Proven on Creditcoin | Event to proof |');
  w('| --- | --- | --- | --- | --- | --- |');
  for (const p of proofs) {
    w(
      `| \`${p.eventName}\` | ${p.agentId} | ${p.detail} | ${p.sourceTxHash ? sepTx(p.sourceTxHash) : '-'} | ${ccTx(p.ccTxHash)} | ${delay(p.delaySeconds)} |`
    );
  }
  w();

  w('### Every credit line transaction');
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

  w('### Contracts');
  w();
  w('| What | Chain | Address |');
  w('| --- | --- | --- |');
  w(`| AssayOracle | Creditcoin | ${ccAddr(DEPLOYMENTS.assayOracle)} |`);
  w(`| CreditLine | Creditcoin | ${ccAddr(DEPLOYMENTS.creditLine)} |`);
  w(`| LendingPool | Creditcoin | ${ccAddr(DEPLOYMENTS.lendingPool)} |`);
  w(`| ERC-8004 Identity | Sepolia | ${sepAddr(REGISTRIES.identity)} |`);
  w(`| ERC-8004 Reputation | Sepolia | ${sepAddr(REGISTRIES.reputation)} |`);
  w();
  para(
    'The two Sepolia registries are the trust anchor of the whole system. Assay ' +
      'did not deploy them and cannot write to them, and they are the only two ' +
      'addresses whose events the oracle will accept.'
  );

  w('### Checking any of this yourself');
  w();
  para(
    'Nothing here requires trusting this file. Open any Creditcoin transaction ' +
      'above and read the `execute` call it made: the block height and Merkle ' +
      'proof it carries are the ones the precompile verified. The Ethereum link ' +
      'in the same row is the transaction that proof was built from. If the two ' +
      'ever disagreed, the proof would not have been accepted.'
  );


  writeFileSync('EVIDENCE.md', out.join('\n'));
  console.log(`\nEVIDENCE.md written: ${proofs.length} proofs, ${creditEvents.length} credit events, ${poolEvents.length} pool events.`);
  if (unresolved > 0) {
    console.warn(
      `\n  WARNING: ${unresolved} proof(s) have no Ethereum link and will render as dashes,\n` +
        `  which reads as missing evidence. Re-run before publishing.`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
