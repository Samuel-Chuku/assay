/**
 * The deterministic envelope.
 *
 * Two halves, both pure functions of the evidence:
 *
 *   preflight  runs before the model. If the evidence cannot be trusted or
 *              there is nothing to read, it refuses on its own and no model
 *              call happens.
 *   clamp      runs after the model. It holds the returned terms inside the
 *              policy bounds, and can only ever make them more conservative.
 *
 * What is deliberately *not* here: any rule that judges whether a record is
 * good. Concentration, counterparty standing, regularity and age are handed to
 * the judge as findings, never scored here. A threshold on quality in this file
 * would be the formula T13 forbids, and it would silently become the real
 * underwriter while the model looked like it was deciding.
 */
import { UNDERWRITING_ENVELOPE as E } from '../config/underwriting';
import type { EvidenceBundle } from './evidence';
import type { Signals } from './signals';
import type { Verdict } from './verdict';

export type Refusal = { refuse: true; reason: string; detail: string };
export type Pass = { refuse: false };

/**
 * Reasons to stop before asking anyone's judgment. Every one of these is about
 * evidence we cannot rely on, not about a borrower we do not like.
 */
export function preflight(evidence: EvidenceBundle, signals: Signals): Refusal | Pass {
  if (!evidence.proven) {
    return {
      refuse: true,
      reason: 'identity-not-proven',
      detail: `Agent ${evidence.agentId} has no proven ERC-8004 identity on this oracle. There is nothing to underwrite.`,
    };
  }

  if (evidence.ownerChanges > 0) {
    return {
      refuse: true,
      reason: 'identity-transferred',
      detail: `The identity has changed hands ${evidence.ownerChanges} time(s) since it was first proven. The record describes work done by a previous holder, so it says nothing about the current one.`,
    };
  }

  if (evidence.walletChanges > 0) {
    return {
      refuse: true,
      reason: 'payment-wallet-changed',
      detail: `The payment wallet has changed ${evidence.walletChanges} time(s). Revenue proven against the old wallet can no longer be traced to this borrower.`,
    };
  }

  if (signals.evidenceAgeDays > E.maxEvidenceAgeDays) {
    return {
      refuse: true,
      reason: 'evidence-stale',
      detail: `The newest proof is ${signals.evidenceAgeDays.toFixed(1)} days old, past the ${E.maxEvidenceAgeDays} day bound. Assay fails closed rather than lending against a stale picture.`,
    };
  }

  if (signals.totalFeedback < E.minFeedbackEntries) {
    return {
      refuse: true,
      reason: 'no-record',
      detail: `No proven feedback at all. There is no track record to read, so there is no judgment to make.`,
    };
  }

  return { refuse: false };
}

export function refusalVerdict(refusal: Refusal, evidence: EvidenceBundle): Verdict {
  return {
    approve: false,
    credit_limit: '0',
    collateral_ratio: 0,
    rate_bps: 0,
    confidence: 1,
    reasoning: `Refused before underwriting, on a deterministic rule rather than a judgment. ${refusal.detail} This is not an assessment of the agent's quality: the evidence itself is unusable, so no assessment is possible.`,
    evidence_used: [
      `agent ${evidence.agentId} on oracle ${evidence.provenance.oracle}`,
      `rule: ${refusal.reason}`,
    ],
  };
}

/**
 * Holds a judgment inside policy. Every adjustment tightens; none can loosen.
 */
export function clamp(verdict: Verdict): { verdict: Verdict; adjustments: string[] } {
  const adjustments: string[] = [];
  const out: Verdict = { ...verdict };

  if (!out.approve) {
    // A refusal carries no terms. Normalise so the log never shows phantom ones.
    return {
      verdict: { ...out, credit_limit: '0', collateral_ratio: 0, rate_bps: 0 },
      adjustments,
    };
  }

  const max = Number(E.maxCreditLimit);
  if (Number(out.credit_limit) > max) {
    adjustments.push(`credit limit reduced from ${out.credit_limit} to the ${E.maxCreditLimit} tCTC policy ceiling`);
    out.credit_limit = E.maxCreditLimit;
  }

  if (out.collateral_ratio < E.minCollateralRatio) {
    adjustments.push(`collateral ratio raised from ${out.collateral_ratio} to the ${E.minCollateralRatio} floor`);
    out.collateral_ratio = E.minCollateralRatio;
  }

  if (out.rate_bps < E.minRateBps) {
    adjustments.push(`rate raised from ${out.rate_bps} to the ${E.minRateBps} bps floor`);
    out.rate_bps = E.minRateBps;
  }
  if (out.rate_bps > E.maxRateBps) {
    adjustments.push(`rate capped from ${out.rate_bps} to the ${E.maxRateBps} bps ceiling`);
    out.rate_bps = E.maxRateBps;
  }

  return { verdict: out, adjustments };
}
