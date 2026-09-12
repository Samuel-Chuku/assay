/**
 * The always-on half of Assay.
 *
 * Watches Ethereum for new ERC-8004 activity about agents we already track,
 * waits out the attestation window, proves each event onto Creditcoin, and
 * re-underwrites any agent whose evidence changed. The site reads the chain, so
 * anything this proves appears there within a minute without a deploy.
 *
 *   pnpm watch            run until stopped
 *   pnpm watch --once     one pass, for cron or a smoke test
 *
 * This process holds a funded key and a model key, which is exactly why it
 * belongs on a machine you control rather than on the web host. Four things
 * keep an unattended wallet honest:
 *
 *   - it only ever proves events for agents whose identity is already proven,
 *     so a public registry full of strangers cannot drain it
 *   - a daily ceiling on proofs, so a bad day cannot empty it
 *   - progress on disk, so a restart neither rescans from genesis nor
 *     re-proves what is already done
 *   - backoff on failure, because these endpoints fail intermittently rather
 *     than staying down
 */
import 'dotenv/config';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { chainInfo } from '@gluwa/usc-sdk';

import { ASSAY_ORACLE_ABI, CREDIT_LINE_ABI } from '../config/abi';
import { GAS_LIMIT_MULTIPLIER, REGISTRIES, SEPOLIA } from '../config/chains';
import { CREDIT_PARAMS } from '../config/demo';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '../config/deployments';
import { IDENTITY_EVENTS, REPUTATION_EVENTS } from '../config/events';
import { WATCHER } from '../config/watcher';
import { serveStatus } from './serve';
import { underwrite } from '../underwriter/underwrite';
import { prove, type ActionName } from './prove';

const STATE_PATH = 'worker/watch-state.json';

type Pending = {
  txHash: string;
  blockNumber: number;
  action: ActionName;
  agentId: number;
  /** When we first saw it, so a stuck item can be reported rather than retried forever. */
  firstSeen: string;
};

type State = {
  /** Last Sepolia block scanned to completion. */
  lastScannedBlock: number;
  pending: Pending[];
  /** Source transactions already proven. Keeps restarts free. */
  proven: string[];
  /** Proof count per UTC day, against the ceiling. */
  spend: Record<string, number>;
  /** Agents the oracle has proven, accumulated rather than rescanned. */
  tracked: number[];
  /** Last Creditcoin block scanned for new agents. */
  trackedScannedTo: number;
};

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    const saved = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Partial<State>;
    // A state file written before incremental tracking has neither field, and
    // must scan from the start rather than silently tracking nobody.
    return {
      lastScannedBlock: saved.lastScannedBlock ?? 0,
      pending: saved.pending ?? [],
      proven: saved.proven ?? [],
      spend: saved.spend ?? {},
      tracked: saved.tracked ?? [],
      trackedScannedTo: saved.trackedScannedTo ?? 0,
    };
  }
  return { lastScannedBlock: 0, pending: [], proven: [], spend: {}, tracked: [], trackedScannedTo: 0 };
}

function saveState(state: State): void {
  mkdirSync('worker', { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const log = (message: string): void =>
  console.log(`${new Date().toISOString().slice(11, 19)}  ${message}`);

/**
 * Which agents we act for: those whose identity the oracle has already proven,
 * whoever paid to prove it. An agent joins by proving its own registration, so
 * this set grows without us doing anything, which is the intended way in.
 *
 * Scanned incrementally and remembered on disk. It used to read the oracle's
 * whole history every pass, which measured 9.62s against Creditcoin's ten
 * second `eth_getLogs` limit on a window growing 5,760 blocks a day. That is
 * not a query that occasionally fails; it is one that was days from failing
 * permanently, and it had already started.
 */
async function trackedAgents(cc: ethers.JsonRpcProvider, state: State): Promise<Set<number>> {
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, cc);
  const head = await cc.getBlockNumber();
  const from = state.trackedScannedTo > 0 ? state.trackedScannedTo + 1 : ORACLE_DEPLOYED_AT_BLOCK;

  const ids = new Set<number>(state.tracked ?? []);

  // One bounded window per pass, for the same reason the Sepolia scan is
  // bounded. A cold start walks the history in chunks rather than one query.
  for (let start = from; start <= head; start += WATCHER.creditcoinScanWindowBlocks) {
    const end = Math.min(start + WATCHER.creditcoinScanWindowBlocks - 1, head);
    const logs = await resilient(`agent scan ${start}-${end}`, () =>
      cc.getLogs({
        address: DEPLOYMENTS.assayOracle,
        fromBlock: start,
        toBlock: end,
        topics: [oracle.interface.getEvent('AgentProven')!.topicHash],
      })
    );
    for (const entry of logs) {
      const parsed = oracle.interface.parseLog({ topics: [...entry.topics], data: entry.data });
      if (parsed) ids.add(Number(parsed.args.agentId));
    }
  }

  state.tracked = [...ids];
  state.trackedScannedTo = head;
  return ids;
}

/** Which of our four actions a Sepolia log maps to, if any. */
function classify(log: ethers.Log): { action: ActionName; agentId: number } | null {
  const topic = log.topics[0];
  const isIdentity = log.address.toLowerCase() === REGISTRIES.identity.toLowerCase();

  if (topic === REPUTATION_EVENTS.newFeedback.topic0) {
    return { action: 'feedback', agentId: Number(BigInt(log.topics[1])) };
  }
  if (isIdentity && topic === IDENTITY_EVENTS.transfer.topic0) {
    return { action: 'transfer', agentId: Number(BigInt(log.topics[3])) };
  }
  if (isIdentity && topic === IDENTITY_EVENTS.metadataSet.topic0) {
    return { action: 'wallet', agentId: Number(BigInt(log.topics[1])) };
  }
  return null;
}

/**
 * Retries the transient failures these endpoints actually produce.
 *
 * A rate limit or a momentary timeout is not a reason to abandon a whole pass
 * and back off for two minutes: the request simply needs asking again. Anything
 * that is not recognisably transient is rethrown immediately, because retrying
 * a genuine error just delays finding out about it.
 */
async function resilient<T>(label: string, run: () => Promise<T>): Promise<T> {
  // Four attempts, backing off 3s, 6s, 12s. A rate limit is measured over a
  // window of seconds, so 2s then 4s was expiring inside the same window it was
  // trying to wait out: three throttles in six seconds, then a failed pass.
  const waits = [3_000, 6_000, 12_000];
  let last: unknown;
  for (let attempt = 0; attempt <= waits.length; attempt++) {
    try {
      return await run();
    } catch (error) {
      last = error;
      const message = (error as Error).message ?? '';
      const transient =
        message.includes('-32005') || // rate limited
        message.includes('Too Many Requests') ||
        message.includes('timeout') ||
        message.includes('missing response') ||
        message.includes('SERVER_ERROR');
      if (!transient) throw error;
      if (attempt < waits.length) {
        const wait = waits[attempt];
        log(`  ${label} was throttled; retrying in ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw last;
}

async function scan(sep: ethers.JsonRpcProvider, state: State, tracked: Set<number>): Promise<void> {
  const head = await resilient('head read', () => sep.getBlockNumber());
  const from = state.lastScannedBlock === 0 ? head - WATCHER.coldStartBlocks : state.lastScannedBlock + 1;
  if (from > head) return;

  // One bounded window per pass: a huge range is what makes getLogs time out.
  const to = Math.min(head, from + WATCHER.scanWindowBlocks - 1);

  const logs = await resilient(`Sepolia scan ${from}-${to}`, () =>
    sep.getLogs({
      address: [REGISTRIES.identity, REGISTRIES.reputation],
      fromBlock: from,
      toBlock: to,
    })
  );

  /**
   * One transaction, one action. This is not a preference, it is a hard limit.
   *
   * `queryId` is derived from chain key, block height and transaction index, and
   * ASCBase rejects a repeat — so a source transaction can only ever be proven
   * once, whichever action goes first. Selling an identity emits `Transfer` and
   * `MetadataSet` together, and proving the wallet half first permanently
   * destroys the chance to record the ownership change. That happened: the
   * wallet proof cost 206k gas and recorded nothing, because clearing an unset
   * wallet is not a change, and the transfer then became unprovable.
   *
   * So pick the most consequential action per transaction. A transfer outranks
   * a wallet change because it always implies one — the registry clears the
   * wallet on transfer — while the reverse is not true.
   */
  const queued = queueEvents(logs, state, tracked);

  state.lastScannedBlock = to;
  if (queued > 0) log(`scanned ${from}-${to}: queued ${queued} new event(s)`);
  saveState(state);
}

/**
 * Queues the events in a batch of Sepolia logs that concern tracked agents,
 * one action per transaction, highest priority wins. Shared by the forward scan
 * and the backfill so the two cannot disagree about what counts.
 */
function queueEvents(logs: ethers.Log[], state: State, tracked: Set<number>): number {
  const priority: Record<ActionName, number> = { transfer: 4, registration: 3, feedback: 2, wallet: 1 };

  const best = new Map<string, Pending>();
  for (const entry of logs) {
    const hit = classify(entry);
    if (!hit || !tracked.has(hit.agentId)) continue;
    if (state.proven.includes(entry.transactionHash)) continue;
    if (state.pending.some((p) => p.txHash === entry.transactionHash)) continue;

    const existing = best.get(entry.transactionHash);
    if (existing && priority[existing.action] >= priority[hit.action]) continue;

    best.set(entry.transactionHash, {
      txHash: entry.transactionHash,
      blockNumber: entry.blockNumber,
      action: hit.action,
      agentId: hit.agentId,
      firstSeen: new Date().toISOString(),
    });
  }

  state.pending.push(...best.values());
  return best.size;
}

/**
 * An agent that has just become tracked may already have a history.
 *
 * The forward scan only keeps events for agents it already knows, so ratings a
 * newcomer received before applying had already been scanned past and thrown
 * away by the time it appeared. A real agent bringing an existing record would
 * have lost all of it. This looks back a day for each newly tracked agent and
 * queues what it finds, once.
 */
async function backfill(sep: ethers.JsonRpcProvider, state: State, newAgents: Set<number>): Promise<void> {
  if (newAgents.size === 0) return;
  const head = await resilient('head read', () => sep.getBlockNumber());
  const from = Math.max(0, head - WATCHER.coldStartBlocks);

  let queued = 0;
  for (let start = from; start <= head; start += WATCHER.scanWindowBlocks) {
    const end = Math.min(start + WATCHER.scanWindowBlocks - 1, head);
    const logs = await resilient(`backfill ${start}-${end}`, () =>
      sep.getLogs({ address: [REGISTRIES.identity, REGISTRIES.reputation], fromBlock: start, toBlock: end })
    );
    queued += queueEvents(logs, state, newAgents);
  }
  log(`backfilled ${[...newAgents].join(', ')}: queued ${queued} earlier event(s)`);
  saveState(state);
}

async function proveReady(state: State, cc: ethers.JsonRpcProvider): Promise<Set<number>> {
  const touched = new Set<number>();
  const day = today();
  state.spend[day] ??= 0;

  /**
   * Check attestation coverage here rather than letting prove() wait.
   *
   * prove() blocks for up to twenty minutes waiting for a height to be
   * attested. That is right for a one-shot CLI and wrong for a loop: one
   * unattested event stalls every item behind it, which is exactly what
   * happened the first time this ran. The watcher's own polling interval is the
   * waiting mechanism, so it only calls prove() for blocks already covered and
   * leaves the rest for the next pass.
   */
  const attested = Number(
    (
      await new chainInfo.PrecompileChainInfoProvider(cc).getLatestAttestedHeightAndHash(
        SEPOLIA.sourceChainKey
      )
    ).height
  );

  const ready = state.pending.filter((p) => p.blockNumber <= attested);
  const holding = state.pending.length - ready.length;
  if (holding > 0) log(`${holding} event(s) still inside the attestation window`);

  for (const item of ready) {
    if (state.spend[day] >= WATCHER.maxProofsPerDay) {
      log(`daily proof ceiling reached (${WATCHER.maxProofsPerDay}); holding the rest`);
      break;
    }

    try {
      log(`proving ${item.action} for agent ${item.agentId} (${item.txHash.slice(0, 10)}…)`);
      await prove(item.txHash, item.action);

      state.proven.push(item.txHash);
      state.pending = state.pending.filter((p) => p !== item);
      state.spend[day] += 1;
      touched.add(item.agentId);
      saveState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Already on chain: nothing to do but stop asking.
      if (message.includes('already submitted') || message.includes('Query already processed')) {
        state.proven.push(item.txHash);
        state.pending = state.pending.filter((p) => p !== item);
        saveState(state);
        continue;
      }

      /**
       * A proof the oracle refuses will be refused forever, so drop it rather
       * than paying to retry every minute. A registration emits a mint
       * Transfer, which is deliberately not a change of hands, and carries no
       * agentWallet key — both are nothing to record, not failures.
       */
      if (message.includes('No ') || message.includes('not proved yet')) {
        log(`  nothing to record (${message.slice(0, 55)}); dropping`);
        state.proven.push(item.txHash);
        state.pending = state.pending.filter((p) => p !== item);
        saveState(state);
        continue;
      }

      log(`  deferred: ${message.slice(0, 90)}`);
    }
  }

  return touched;
}

/**
 * Write down any freeze the new evidence just triggered.
 *
 * Proving a transfer moves the oracle's counter, which makes a draw revert
 * straight away — but the line's *recorded* state stays Active until somebody
 * calls `freezeIfTriggered`. An unattended operator is exactly who should make
 * that call, so the chain says what is true without waiting for a person.
 */
async function recordFreezes(agentIds: Set<number>, cc: ethers.JsonRpcProvider): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY!;
  const wallet = new ethers.Wallet(key.startsWith('0x') ? key : `0x${key}`, cc);
  const credit = new ethers.Contract(DEPLOYMENTS.creditLine, CREDIT_LINE_ABI, wallet);

  for (const agentId of agentIds) {
    try {
      const line = await credit.getLine(agentId);
      if (Number(line.state) !== 2) continue; // only an Active line can freeze

      const reason = Number(await credit.pendingFreezeReason(agentId));
      if (reason === 0) continue;

      const tx = await credit.freezeIfTriggered(agentId);
      const receipt = await tx.wait();
      log(`froze agent ${agentId}, reason ${reason} — ${receipt?.hash}`);
    } catch (error) {
      log(`freeze check for ${agentId} failed: ${(error as Error).message.slice(0, 80)}`);
    }
  }
}

async function reUnderwrite(agentIds: Set<number>, cc: ethers.JsonRpcProvider): Promise<void> {
  for (const agentId of agentIds) {
    try {
      const { entry, replayed } = await underwrite(agentId);
      log(
        `underwrote ${agentId}: ${entry.approve ? 'APPROVED' : 'REFUSED'}` +
          `${replayed ? ' (unchanged)' : ` by ${entry.source}`}`
      );
      if (entry.approve) await offerIfNone(agentId, entry, cc);
    } catch (error) {
      log(`underwriting ${agentId} failed: ${(error as Error).message.slice(0, 90)}`);
    }
  }
}

/**
 * An approval becomes an offer, on its own.
 *
 * Until this existed the watcher would judge an agent, log APPROVED, and stop.
 * Turning that into a line required an operator to run a script by hand, which
 * meant that in practice only agents we chose to run it for ever got credit.
 * Everything else on the borrower's path is permissionless; this was the one
 * step that quietly was not, and it is the step the underwriter key exists for.
 *
 * Offering moves no funds. The agent still has to post collateral to accept,
 * and every draw is bounded by the pool's liquidity and re-checks the freeze
 * triggers. The judgment is the gate on who gets an offer; this only makes the
 * judgment's outcome real.
 */
async function offerIfNone(
  agentId: number,
  verdict: { credit_limit: string; collateral_ratio: number; rate_bps: number; reasoningHash: string },
  cc: ethers.JsonRpcProvider
): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY!;
  const underwriter = new ethers.Wallet(key.startsWith('0x') ? key : `0x${key}`, cc);
  const credit = new ethers.Contract(DEPLOYMENTS.creditLine, CREDIT_LINE_ABI, underwriter);

  const line = await credit.getLine(agentId);
  if (Number(line.state) !== 0) return; // already offered, active, frozen, or repaid

  const limit = ethers.parseEther(verdict.credit_limit);
  const collateral = (limit * BigInt(Math.round(verdict.collateral_ratio * 10_000))) / 10_000n;
  const expiry = (await cc.getBlockNumber()) + CREDIT_PARAMS.durationBlocks;
  const args = [agentId, limit, collateral, verdict.rate_bps, expiry, verdict.reasoningHash] as const;

  try {
    const gas = await credit.offer.estimateGas(...args);
    const buffer = BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100));
    const tx = await credit.offer(...args, { gasLimit: (gas * buffer) / 100n });
    const receipt = await tx.wait();
    if (receipt?.status === 1) {
      log(
        `  offered ${agentId} a line: ${ethers.formatEther(limit)} tCTC at ${verdict.rate_bps} bps, ` +
          `${ethers.formatEther(collateral)} collateral  ${receipt.hash}`
      );
    } else {
      log(`  offer to ${agentId} reverted`);
    }
  } catch (error) {
    log(`  could not offer ${agentId}: ${(error as Error).message.slice(0, 100)}`);
  }
}

async function pass(sep: ethers.JsonRpcProvider, cc: ethers.JsonRpcProvider): Promise<void> {
  const state = loadState();
  const before = new Set(state.tracked);
  const tracked = await trackedAgents(cc, state);
  // Persist the tracking cursor even if the Sepolia scan below fails, so a bad
  // pass does not make the next one rescan the whole oracle history.
  saveState(state);

  const newcomers = new Set([...tracked].filter((id) => !before.has(id)));
  // A first run has no "before" and would backfill everyone; that is what the
  // cold-start scan already does, so only backfill once tracking is established.
  if (before.size > 0 && newcomers.size > 0) {
    try {
      await backfill(sep, state, newcomers);
    } catch (error) {
      // The tracked set was saved above, so without this the agent would count
      // as known on the next pass and its history would never be looked for
      // again. Un-track it so the next pass treats it as new and tries again.
      state.tracked = state.tracked.filter((id) => !newcomers.has(id));
      saveState(state);
      throw error;
    }
  }

  await scan(sep, state, tracked);
  const touched = await proveReady(state, cc);
  if (touched.size > 0) {
    await recordFreezes(touched, cc);
    await reUnderwrite(touched, cc);
  }

  if (state.pending.length > 0) {
    log(`${state.pending.length} event(s) waiting on attestation`);
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');

  if (!process.env.DEPLOYER_PRIVATE_KEY?.trim()) {
    throw new Error('DEPLOYER_PRIVATE_KEY is not set; the watcher cannot pay for proofs.');
  }

  const sep = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const cc = new ethers.JsonRpcProvider(process.env.CREDITCOIN_RPC_URL);

  log(`watching ${REGISTRIES.identity.slice(0, 10)}… and ${REGISTRIES.reputation.slice(0, 10)}… on Sepolia`);
  log(`ceiling ${WATCHER.maxProofsPerDay} proofs/day, polling every ${WATCHER.pollSeconds}s`);

  const startedAt = new Date().toISOString();
  let lastTickAt: string | null = null;
  let failures = 0;

  // A one-shot run has nothing to serve and no time to serve it.
  if (!once) {
    serveStatus(() => {
      const state = loadState();
      return {
        startedAt,
        lastTickAt,
        lastScannedBlock: state.lastScannedBlock,
        pending: state.pending.length,
        proofsToday: state.spend[today()] ?? 0,
        proofCeiling: WATCHER.maxProofsPerDay,
        consecutiveFailures: failures,
      };
    });
  }

  for (;;) {
    try {
      await pass(sep, cc);
      lastTickAt = new Date().toISOString();
      failures = 0;
    } catch (error) {
      failures++;
      // These endpoints fail intermittently; back off rather than hammer.
      const wait = Math.min(WATCHER.pollSeconds * 2 ** failures, WATCHER.maxBackoffSeconds);
      log(`pass failed (${(error as Error).message.slice(0, 80)}); retrying in ${wait}s`);
      if (once) process.exit(1);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    if (once) return;
    await new Promise((r) => setTimeout(r, WATCHER.pollSeconds * 1000));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
