/**
 * The verdict the underwriter returns, and the log it leaves behind.
 *
 * Every decision is appended to underwriter/verdicts/*.jsonl with the evidence
 * and signals that produced it, so any verdict can be reconstructed and argued
 * with afterwards. A credit decision nobody can audit is not underwriting.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { ethers } from 'ethers';

import type { EvidenceBundle } from './evidence';
import type { Signals } from './signals';

export type Verdict = {
  approve: boolean;
  /** In tCTC. Zero when refusing. */
  credit_limit: string;
  /** Collateral as a fraction of the limit, 0 to 1. */
  collateral_ratio: number;
  /** Fixed simple interest in basis points. */
  rate_bps: number;
  /** The judge's own confidence in this decision, 0 to 1. */
  confidence: number;
  /** Written reasoning. The part a formula cannot produce. */
  reasoning: string;
  /** Which specific facts the decision rested on. */
  evidence_used: string[];
};

export type LoggedVerdict = Verdict & {
  agentId: number;
  decidedAt: string;
  model: string;
  reasoningHash: string;
  /** Identifies the exact facts this verdict was made against. */
  evidenceHash: string;
  /**
   * How this verdict was reached.
   *   envelope  a deterministic rule refused before any judgment was sought
   *   judgment  the model decided, then the envelope held it inside policy
   *   cache     identical evidence had already been judged; this is a replay
   */
  source: 'envelope' | 'judgment' | 'cache';
  /** Every way the envelope tightened the judgment. Empty when it did not. */
  adjustments: string[];
  evidence: EvidenceBundle;
  signals: Signals;
};

const VERDICT_DIR = 'underwriter/verdicts';

/** Binds the written reasoning to the on-chain offer, so the text cannot be swapped later. */
export function reasoningHash(reasoning: string): string {
  return ethers.id(reasoning);
}

export function validateVerdict(value: unknown): Verdict {
  const v = value as Partial<Verdict>;
  const problems: string[] = [];

  if (typeof v.approve !== 'boolean') problems.push('approve must be a boolean');
  if (typeof v.credit_limit !== 'string') problems.push('credit_limit must be a decimal string');
  if (typeof v.collateral_ratio !== 'number' || v.collateral_ratio < 0 || v.collateral_ratio > 1) {
    problems.push('collateral_ratio must be between 0 and 1');
  }
  if (typeof v.rate_bps !== 'number' || v.rate_bps < 0 || v.rate_bps > 10_000) {
    problems.push('rate_bps must be between 0 and 10000');
  }
  if (typeof v.confidence !== 'number' || v.confidence < 0 || v.confidence > 1) {
    problems.push('confidence must be between 0 and 1');
  }
  if (typeof v.reasoning !== 'string' || v.reasoning.trim().length < 40) {
    problems.push('reasoning must be written out, not a stub');
  }
  if (!Array.isArray(v.evidence_used) || v.evidence_used.length === 0) {
    problems.push('evidence_used must cite at least one fact');
  }
  if (v.approve === true && Number(v.credit_limit) <= 0) {
    problems.push('an approval must carry a credit limit above zero');
  }
  if (v.approve === false && Number(v.credit_limit) !== 0) {
    problems.push('a refusal must carry a zero credit limit');
  }

  if (problems.length > 0) {
    throw new Error(`Underwriter returned an unusable verdict:\n  - ${problems.join('\n  - ')}`);
  }
  return v as Verdict;
}

export function logVerdict(entry: LoggedVerdict): string {
  mkdirSync(VERDICT_DIR, { recursive: true });
  const path = `${VERDICT_DIR}/${entry.decidedAt.slice(0, 10)}.jsonl`;
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
  return path;
}
