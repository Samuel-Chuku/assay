import 'server-only';

import { ethers } from 'ethers';

import { ASSAY_ORACLE_ABI, CREDIT_LINE_ABI, LENDING_POOL_ABI } from '@assay/config/abi';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '@assay/config/deployments';
import verdictsJson from '@assay/config/verdicts.json';
import { creditcoin, retry } from './chain';
import { fullHistoryLogs } from './logs';

/**
 * Agents, their verdicts, their credit lines, and the pool.
 *
 * The verdict's reasoning is model output and cannot be re-derived, so it is
 * read from a file. What keeps that honest is `reasoningHash`: the offer bound
 * that hash on chain, so recomputing keccak256 over the displayed text proves
 * it is the text the contract was given. `reasoningVerified` carries the
 * result, and the UI is expected to show when it fails rather than hide it.
 */

export const LINE_STATES = ['None', 'Offered', 'Active', 'Frozen', 'Repaid', 'Defaulted'] as const;
export const FREEZE_REASONS = [
  'NotFrozen',
  'IdentityTransferred',
  'PaymentWalletChanged',
  'EvidenceStale',
] as const;

export type Verdict = {
  agentId: number;
  approve: boolean;
  credit_limit: string;
  collateral_ratio: number;
  rate_bps: number;
  confidence: number;
  reasoning: string;
  evidence_used: string[];
  decidedAt: string;
  model: string;
  reasoningHash: string;
  /** 'judgment' when a model decided it, 'envelope' when policy refused first. */
  source: string;
  adjustments: string[];
};

export type CreditLine = {
  state: (typeof LINE_STATES)[number];
  borrower: string;
  limit: string;
  collateralPosted: string;
  principalOutstanding: string;
  interestOwed: string;
  totalDrawn: string;
  interestBps: number;
  expiryBlock: number;
  reasoningHash: string;
  freezeReason: (typeof FREEZE_REASONS)[number];
  /** The reason a draw would be refused right now, recorded or not. */
  pendingFreezeReason: (typeof FREEZE_REASONS)[number];
};

export type Agent = {
  agentId: number;
  owner: string;
  currentOwner: string;
  paymentWallet: string;
  feedbackCount: number;
  ownerChanges: number;
  walletChanges: number;
  evidenceAgeBlocks: number;
  verdict: Verdict | null;
  /** keccak256 of the shown reasoning matches the verdict's own hash. */
  reasoningVerified: boolean | null;
  /**
   * The displayed verdict is the one this line was opened against. False means
   * the agent has been re-judged since, which is a normal thing to have
   * happened and not a failure of any check.
   */
  boundToLine: boolean | null;
  line: CreditLine | null;
};

export type Pool = {
  totalAssets: string;
  totalDeployed: string;
  liquid: string;
  utilisation: number;
};

/**
 * Verdicts, live where possible and committed otherwise.
 *
 * Judgments are formed by the watcher, which runs on its own machine, while
 * this site is built from git. Without a live read, the site would show
 * whatever verdict was committed at deploy time forever, and re-underwriting
 * would happen where nobody could see it.
 *
 * The committed file stays the floor. A live fetch only ever replaces it
 * wholesale and only when it parses, so an unreachable or broken watcher
 * degrades to the last known-good verdicts rather than to nothing. That is the
 * fail-closed rule applied to a second source: never fall back to *less*
 * verified data than we already had.
 *
 * Trusting a URL is safe here for one specific reason. Each verdict carries a
 * `reasoningHash` that was bound into its on-chain offer, and `getAgent` below
 * recomputes keccak256 over the reasoning it received. Substituted text fails
 * that check and the UI shows it failing, so the worst a hostile response can
 * do is make a verdict visibly unverified.
 */
const committed = verdictsJson as Verdict[];

const VERDICTS_URL = process.env.VERDICTS_URL;

/** Long enough for a slow hop, short enough not to hold a render open. */
const VERDICTS_TIMEOUT_MS = 4_000;

function usable(payload: unknown): payload is Verdict[] {
  return (
    Array.isArray(payload) &&
    payload.length > 0 &&
    payload.every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as Verdict).agentId === 'number' &&
        typeof (v as Verdict).reasoning === 'string' &&
        typeof (v as Verdict).reasoningHash === 'string'
    )
  );
}

/**
 * One fetch per window, however many agents are being rendered.
 *
 * `getAgents` resolves each agent separately, so without this a five-agent page
 * would make five identical requests, and concurrent ones would all miss a
 * plain time check together.
 */
let cached: { at: number; verdicts: Verdict[] } | null = null;
let inFlight: Promise<Verdict[]> | null = null;

async function loadVerdicts(): Promise<Verdict[]> {
  if (!VERDICTS_URL) return committed;

  if (cached && Date.now() - cached.at < VERDICTS_TIMEOUT_MS * 2) {
    return cached.verdicts;
  }
  if (!inFlight) {
    inFlight = fetchVerdicts()
      .then((verdicts) => {
        cached = { at: Date.now(), verdicts };
        return verdicts;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

async function fetchVerdicts(url = VERDICTS_URL): Promise<Verdict[]> {
  if (!url) return committed;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(VERDICTS_TIMEOUT_MS),
      /*
       * Not `no-store`. That opts the whole route out of static rendering, so
       * every visitor would re-read both chains instead of one render per
       * minute serving everybody. Revalidating on its own window keeps the page
       * prerendered and still picks up a new verdict within the minute.
       */
      next: { revalidate: 30 },
    });
    if (!res.ok) return committed;

    const payload: unknown = await res.json();
    return usable(payload) ? (payload as Verdict[]) : committed;
  } catch {
    // Unreachable watcher is a normal state, not an error worth failing on.
    return committed;
  }
}

function toEther(value: bigint): string {
  return ethers.formatEther(value);
}

export async function getPool(): Promise<Pool> {
  const cc = creditcoin();
  const pool = new ethers.Contract(DEPLOYMENTS.lendingPool, LENDING_POOL_ABI, cc);

  const [assets, deployed] = await retry('reading the pool', 2, () =>
    Promise.all([pool.totalAssets() as Promise<bigint>, pool.totalDeployed() as Promise<bigint>])
  );

  return {
    totalAssets: toEther(assets),
    totalDeployed: toEther(deployed),
    liquid: toEther(assets - deployed),
    utilisation: assets === 0n ? 0 : Number((deployed * 10_000n) / assets) / 10_000,
  };
}

/** Every agent the oracle has proven an identity for, newest first. */
export async function getAgentIds(): Promise<number[]> {
  const cc = creditcoin();
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, cc);
  const topic = oracle.interface.getEvent('AgentProven')!.topicHash;

  const logs = await retry('listing proven agents', 3, () =>
    fullHistoryLogs(cc, { address: DEPLOYMENTS.assayOracle, topics: [topic] })
  );

  const ids = new Set<number>();
  for (const log of logs) {
    const parsed = oracle.interface.parseLog({ topics: [...log.topics], data: log.data });
    if (parsed) ids.add(Number(parsed.args.agentId));
  }
  return [...ids].sort((a, b) => b - a);
}

export async function getAgent(agentId: number): Promise<Agent | null> {
  const cc = creditcoin();
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, cc);
  const credit = new ethers.Contract(DEPLOYMENTS.creditLine, CREDIT_LINE_ABI, cc);

  const [record, head] = await retry(`reading agent ${agentId}`, 2, () =>
    Promise.all([oracle.getAgent(agentId), cc.getBlockNumber()])
  );
  if (!record.proven) return null;

  const verdict = (await loadVerdicts()).find((v) => v.agentId === agentId) ?? null;

  let line: CreditLine | null = null;
  try {
    const raw = await credit.getLine(agentId);
    if (Number(raw.state) !== 0) {
      const pending = Number(await credit.pendingFreezeReason(agentId));
      line = {
        state: LINE_STATES[Number(raw.state)],
        borrower: raw.borrower,
        limit: toEther(raw.limit),
        collateralPosted: toEther(raw.collateralPosted),
        principalOutstanding: toEther(raw.principalOutstanding),
        interestOwed: toEther(raw.interestOwed),
        totalDrawn: toEther(raw.totalDrawn),
        interestBps: Number(raw.interestBps),
        expiryBlock: Number(raw.expiryBlock),
        reasoningHash: raw.reasoningHash,
        freezeReason: FREEZE_REASONS[Number(raw.freezeReason)],
        pendingFreezeReason: FREEZE_REASONS[pending],
      };
    }
  } catch {
    // No line is a normal state, not an error.
  }

  /**
   * Two different questions, which an earlier version collapsed into one and
   * got wrong.
   *
   * `reasoningVerified` asks whether the text shown is the text that was
   * hashed. That is the tamper check, and it is the only one that can fail
   * dishonestly: a substituted reasoning is caught here regardless of where the
   * text came from.
   *
   * `boundToLine` asks whether the judgment on display is the same one this
   * line was opened on. An agent is re-judged whenever its evidence moves, so a
   * frozen agent legitimately shows a refusal formed *after* the line was
   * offered against an earlier approval. Comparing that refusal to the offer's
   * hash reported "does not match the chain" on a verdict that was perfectly
   * authentic, which is an accusation of tampering where none happened.
   */
  const reasoningVerified = verdict ? ethers.id(verdict.reasoning) === verdict.reasoningHash : null;

  const boundToLine = verdict && line ? verdict.reasoningHash === line.reasoningHash : null;

  return {
    agentId,
    owner: record.owner,
    currentOwner: record.currentOwner,
    paymentWallet: record.paymentWallet,
    feedbackCount: Number(record.feedbackCount),
    ownerChanges: Number(record.ownerChanges),
    walletChanges: Number(record.walletChanges),
    evidenceAgeBlocks: head - Number(record.lastEvidenceBlock),
    verdict,
    reasoningVerified,
    boundToLine,
    line,
  };
}

export async function getAgents(): Promise<Agent[]> {
  const ids = await getAgentIds();
  const settled = await Promise.all(ids.map((id) => getAgent(id).catch(() => null)));
  return settled.filter((a): a is Agent => a !== null);
}
