import 'server-only';

import { ethers } from 'ethers';

import { ASSAY_ORACLE_ABI, BLOCK_PROVER_ABI } from '@assay/config/abi';
import { CREDITCOIN, REGISTRIES } from '@assay/config/chains';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '@assay/config/deployments';
import { creditcoin, retry, sepolia } from './chain';

/**
 * Reads proven facts off Creditcoin and reconstructs each one's link back to
 * Ethereum.
 *
 * The design reference's first law is that a value shown as proven carries both
 * its Sepolia source transaction and its Creditcoin verification transaction.
 * The oracle stores neither the source hash nor the source block: ASCBase does
 * not pass them to the handler, and the decoded transaction does not carry
 * them. So both are recovered rather than stored.
 *
 *   submission calldata  ->  chainKey, blockHeight, merkleRoot, siblings
 *   siblings + precompile ->  transaction index within the source block
 *   blockHeight + index   ->  the Sepolia transaction hash
 *
 * That means every line of a proof row traces to what was actually proven, with
 * no side file to fall out of step. The attestation delay is measured the same
 * way, from the two block timestamps, so `+9m24s` is a measurement rather than
 * a claim.
 *
 * Server-only: the RPC endpoints and this reconstruction never reach a browser.
 */

export type FactKind = 'identity' | 'feedback' | 'transfer' | 'wallet';

/** A decoded oracle event, independent of ethers' EventLog wrapper. */
type OracleLog = {
  eventName: string;
  args: ethers.Result;
  transactionHash: string;
  blockNumber: number;
  index: number;
};

export type ProvenFact = {
  kind: FactKind;
  /** The ERC-8004 event that was proven, named as the registry emits it. */
  eventName: string;
  agentId: number;
  /** The registry that emitted it. Always one of the two hardcoded addresses. */
  emitter: string;
  emitterName: string;
  /** A short human reading of the payload, for line 1. */
  detail: string;
  sourceTxHash: string;
  sourceBlock: number;
  verificationTxHash: string;
  verificationBlock: number;
  /**
   * Seconds between the source block and its verification on Creditcoin, or
   * null when the source block header could not be read in time. Never
   * estimated.
   */
  attestationDelaySeconds: number | null;
  queryId: string;
};

const IDENTITY_EVENTS: Record<string, { kind: FactKind; eventName: string }> = {
  AgentProven: { kind: 'identity', eventName: 'Registered' },
  IdentityTransferProven: { kind: 'transfer', eventName: 'Transfer' },
  WalletChangeProven: { kind: 'wallet', eventName: 'MetadataSet · agentWallet' },
};

/**
 * Resolving a fact costs four calls across two chains. Firing twenty of those
 * at once is what a public endpoint rate-limits, and one timeout loses the
 * whole page. A small window is slower and finishes.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Caches keyed by block number, so a transaction-heavy block is fetched once. */
type Caches = {
  sourceBlocks: Map<number, Promise<ethers.Block | null>>;
  verificationBlocks: Map<number, Promise<ethers.Block | null>>;
};

type ResolvedSource = {
  sourceTxHash: string;
  sourceBlock: number;
  verificationBlock: number;
  delaySeconds: number | null;
};

async function resolveSource(
  log: OracleLog,
  oracle: ethers.Contract,
  cc: ethers.JsonRpcProvider,
  sep: ethers.JsonRpcProvider,
  prover: ethers.Contract,
  caches: Caches
): Promise<ResolvedSource> {
  const submission = await retry(`submission ${log.transactionHash.slice(0, 10)}`, 2, () =>
    cc.getTransaction(log.transactionHash)
  );
  if (!submission) throw new Error(`no submission transaction for ${log.transactionHash}`);

  const decoded = oracle.interface.parseTransaction({ data: submission.data });
  if (!decoded || decoded.name !== 'execute') {
    throw new Error(`submission ${log.transactionHash} is not an execute call`);
  }

  const blockHeight = Number(decoded.args.blockHeight);
  const siblings = (decoded.args.siblings as [string, boolean][]).map((s) => ({
    hash: s[0],
    isLeft: s[1],
  }));

  const txIndex = Number(
    await prover.calculateTxIndex({ root: decoded.args.merkleRoot, siblings })
  );

  /**
   * Ask for the one transaction, not the whole block. Fetching the block
   * transfers every transaction in it to read one: 411ms median against 260ms
   * for this call, and a render resolves up to forty of them.
   */
  const sourceTx = (await retry(`Sepolia tx ${blockHeight}#${txIndex}`, 2, () =>
    sep.send('eth_getTransactionByBlockNumberAndIndex', [
      quantity(blockHeight),
      quantity(txIndex),
    ])
  )) as { hash?: string } | null;

  if (!sourceTx?.hash) {
    throw new Error(`Sepolia block ${blockHeight} has no transaction at index ${txIndex}`);
  }

  if (!caches.sourceBlocks.has(blockHeight)) {
    caches.sourceBlocks.set(blockHeight, withTimeout(sep.getBlock(blockHeight), 30_000));
  }
  if (!caches.verificationBlocks.has(log.blockNumber)) {
    caches.verificationBlocks.set(log.blockNumber, withTimeout(cc.getBlock(log.blockNumber), 30_000));
  }

  const [sourceBlock, verificationBlock] = await Promise.all([
    caches.sourceBlocks.get(blockHeight)!,
    caches.verificationBlocks.get(log.blockNumber)!,
  ]);

  /**
   * The delay needs both block timestamps, and a header fetch is the slow call
   * on a free endpoint. If it does not arrive, the row still renders: it has
   * both explorer links, which is what makes it a proven fact. Reporting an
   * estimated delay would be worse than reporting none.
   */
  const delaySeconds =
    sourceBlock && verificationBlock
      ? Math.max(0, verificationBlock.timestamp - sourceBlock.timestamp)
      : null;

  return {
    sourceTxHash: sourceTx.hash,
    sourceBlock: blockHeight,
    verificationBlock: log.blockNumber,
    delaySeconds,
  };
}

/**
 * A JSON-RPC quantity: hex, no leading zeros. `ethers.toBeHex(0)` gives `0x00`,
 * which some nodes reject — and index 0 is exactly the case that would hit it,
 * for any fact whose source transaction was first in its block.
 */
function quantity(value: number): string {
  return `0x${value.toString(16)}`;
}

/** Resolves to null rather than rejecting, so one slow header cannot lose a row. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function describe(log: OracleLog): { kind: FactKind; eventName: string; detail: string } {
  const args = log.args;

  if (log.eventName === 'FeedbackProven') {
    const value = Number(args.value) / 10 ** Number(args.valueDecimals);
    return {
      kind: 'feedback',
      eventName: 'NewFeedback',
      detail: `${value.toFixed(2)} from ${short(args.client as string)} · entry ${args.feedbackIndex}`,
    };
  }

  if (log.eventName === 'IdentityTransferProven') {
    return {
      kind: 'transfer',
      eventName: 'Transfer',
      detail: `${short(args.from as string)} → ${short(args.to as string)}`,
    };
  }

  if (log.eventName === 'WalletChangeProven') {
    const wallet = args.newWallet as string;
    return {
      kind: 'wallet',
      eventName: 'MetadataSet · agentWallet',
      detail: wallet === ethers.ZeroAddress ? 'wallet cleared' : `wallet set to ${short(wallet)}`,
    };
  }

  return {
    kind: 'identity',
    eventName: 'Registered',
    detail: `owner ${short(args.owner as string)}`,
  };
}

function short(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-4)}`;
}

/**
 * Every proven fact, newest first.
 *
 * A fact whose source cannot be reconstructed is dropped rather than shown with
 * one link. The reference is explicit: no "proven but link pending". If both
 * links are not there, it does not get to look proven.
 */
export async function getProvenFacts(limit = 20): Promise<ProvenFact[]> {
  const cc = creditcoin();
  const sep = sepolia();
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, cc);
  const prover = new ethers.Contract(CREDITCOIN.blockProverPrecompile, BLOCK_PROVER_ABI, cc);

  /**
   * One call, not four. Creditcoin's RPC abandons any `eth_getLogs` that takes
   * over ten seconds, and four concurrent scans across the oracle's whole life
   * reliably crossed that line. A single request with the four signatures as an
   * OR filter does the same work in one pass.
   */
  const names = ['AgentProven', 'FeedbackProven', 'IdentityTransferProven', 'WalletChangeProven'];
  const topics = names.map((name) => oracle.interface.getEvent(name)!.topicHash);

  const raw = await retry('reading proven facts from Creditcoin', 3, () =>
    cc.getLogs({
      address: DEPLOYMENTS.assayOracle,
      fromBlock: ORACLE_DEPLOYED_AT_BLOCK,
      toBlock: 'latest',
      topics: [topics],
    })
  );

  const logs = raw
    .map((log): OracleLog | null => {
      const parsed = oracle.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed) return null;
      return {
        eventName: parsed.name,
        args: parsed.args,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        index: log.index,
      };
    })
    .filter((l): l is OracleLog => l !== null)
    .sort((a, b) => b.blockNumber - a.blockNumber || b.index - a.index)
    .slice(0, limit);

  const caches: Caches = { sourceBlocks: new Map(), verificationBlocks: new Map() };

  const settled = await mapWithConcurrency(
    logs,
    4,
    async (log): Promise<ProvenFact> => {
      const source = await resolveSource(log, oracle, cc, sep, prover, caches);
      const described = describe(log);
      const fromIdentity = log.eventName in IDENTITY_EVENTS;

      return {
        ...described,
        agentId: Number(log.args.agentId),
        emitter: fromIdentity ? REGISTRIES.identity : REGISTRIES.reputation,
        emitterName: fromIdentity ? 'Identity Registry' : 'Reputation Registry',
        sourceTxHash: source.sourceTxHash,
        sourceBlock: source.sourceBlock,
        verificationTxHash: log.transactionHash,
        verificationBlock: source.verificationBlock,
        attestationDelaySeconds: source.delaySeconds,
        queryId: String(log.args.queryId),
      };
    }
  );

  const resolved = settled
    .filter((r): r is PromiseFulfilledResult<ProvenFact> => r.status === 'fulfilled')
    .map((r) => r.value);

  /**
   * Dropping a fact we cannot fully resolve is right; reporting "no evidence
   * yet" when the oracle plainly holds some is not. If everything failed, say
   * why rather than letting the empty state tell a judge the system is idle.
   */
  if (resolved.length === 0 && logs.length > 0) {
    const firstFailure = settled.find((r) => r.status === 'rejected');
    const reason =
      firstFailure && firstFailure.status === 'rejected'
        ? String(firstFailure.reason?.message ?? firstFailure.reason)
        : 'unknown';
    throw new Error(
      `${logs.length} proven facts are recorded but none could be resolved back to Sepolia: ${reason}`
    );
  }

  return resolved;
}
