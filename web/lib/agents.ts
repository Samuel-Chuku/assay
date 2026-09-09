import 'server-only';

import { ethers } from 'ethers';

import { ASSAY_ORACLE_ABI, CREDIT_LINE_ABI, LENDING_POOL_ABI } from '@assay/config/abi';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '@assay/config/deployments';
import verdictsJson from '@assay/config/verdicts.json';
import { creditcoin, retry } from './chain';

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
  /** keccak256 of the shown reasoning matches the hash bound on chain. */
  reasoningVerified: boolean | null;
  line: CreditLine | null;
};

export type Pool = {
  totalAssets: string;
  totalDeployed: string;
  liquid: string;
  utilisation: number;
};

const verdicts = verdictsJson as Verdict[];

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
    cc.getLogs({
      address: DEPLOYMENTS.assayOracle,
      fromBlock: ORACLE_DEPLOYED_AT_BLOCK,
      toBlock: 'latest',
      topics: [topic],
    })
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

  const verdict = verdicts.find((v) => v.agentId === agentId) ?? null;

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
   * Only claim verification when there is an on-chain hash to check against.
   * A verdict with no line yet is unverified rather than verified-true.
   */
  const reasoningVerified =
    verdict && line ? ethers.id(verdict.reasoning) === line.reasoningHash : null;

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
    line,
  };
}

export async function getAgents(): Promise<Agent[]> {
  const ids = await getAgentIds();
  const settled = await Promise.all(ids.map((id) => getAgent(id).catch(() => null)));
  return settled.filter((a): a is Agent => a !== null);
}
