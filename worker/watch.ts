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

import { ASSAY_ORACLE_ABI } from '../config/abi';
import { REGISTRIES, SEPOLIA } from '../config/chains';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '../config/deployments';
import { IDENTITY_EVENTS, REPUTATION_EVENTS } from '../config/events';
import { WATCHER } from '../config/watcher';
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
};

function loadState(): State {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as State;
  return { lastScannedBlock: 0, pending: [], proven: [], spend: {} };
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
 * Which agents we act for: those whose identity the oracle has already proven.
 * Onboarding a new agent stays a deliberate act, not something a watcher does
 * on its own with someone else's gas.
 */
async function trackedAgents(cc: ethers.JsonRpcProvider): Promise<Set<number>> {
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, cc);
  const logs = await cc.getLogs({
    address: DEPLOYMENTS.assayOracle,
    fromBlock: ORACLE_DEPLOYED_AT_BLOCK,
    toBlock: 'latest',
    topics: [oracle.interface.getEvent('AgentProven')!.topicHash],
  });

  const ids = new Set<number>();
  for (const entry of logs) {
    const parsed = oracle.interface.parseLog({ topics: [...entry.topics], data: entry.data });
    if (parsed) ids.add(Number(parsed.args.agentId));
  }
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

async function scan(sep: ethers.JsonRpcProvider, state: State, tracked: Set<number>): Promise<void> {
  const head = await sep.getBlockNumber();
  const from = state.lastScannedBlock === 0 ? head - WATCHER.coldStartBlocks : state.lastScannedBlock + 1;
  if (from > head) return;

  // One bounded window per pass: a huge range is what makes getLogs time out.
  const to = Math.min(head, from + WATCHER.scanWindowBlocks - 1);

  const logs = await sep.getLogs({
    address: [REGISTRIES.identity, REGISTRIES.reputation],
    fromBlock: from,
    toBlock: to,
  });

  let queued = 0;
  for (const entry of logs) {
    const hit = classify(entry);
    if (!hit || !tracked.has(hit.agentId)) continue;
    if (state.proven.includes(entry.transactionHash)) continue;
    if (state.pending.some((p) => p.txHash === entry.transactionHash && p.action === hit.action)) continue;

    state.pending.push({
      txHash: entry.transactionHash,
      blockNumber: entry.blockNumber,
      action: hit.action,
      agentId: hit.agentId,
      firstSeen: new Date().toISOString(),
    });
    queued++;
  }

  state.lastScannedBlock = to;
  if (queued > 0) log(`scanned ${from}-${to}: queued ${queued} new event(s)`);
  saveState(state);
}

async function proveReady(state: State): Promise<Set<number>> {
  const touched = new Set<number>();
  const day = today();
  state.spend[day] ??= 0;

  for (const item of [...state.pending]) {
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

      // Not attested yet is the normal case, not a failure.
      log(`  not ready: ${message.slice(0, 90)}`);
    }
  }

  return touched;
}

async function reUnderwrite(agentIds: Set<number>): Promise<void> {
  for (const agentId of agentIds) {
    try {
      const { entry, replayed } = await underwrite(agentId);
      log(
        `underwrote ${agentId}: ${entry.approve ? 'APPROVED' : 'REFUSED'}` +
          `${replayed ? ' (unchanged)' : ` by ${entry.source}`}`
      );
    } catch (error) {
      log(`underwriting ${agentId} failed: ${(error as Error).message.slice(0, 90)}`);
    }
  }
}

async function pass(sep: ethers.JsonRpcProvider, cc: ethers.JsonRpcProvider): Promise<void> {
  const state = loadState();
  const tracked = await trackedAgents(cc);

  await scan(sep, state, tracked);
  const touched = await proveReady(state);
  if (touched.size > 0) await reUnderwrite(touched);

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

  let failures = 0;
  for (;;) {
    try {
      await pass(sep, cc);
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
