/**
 * The deterministic envelope around the underwriter's judgment.
 *
 * These are policy bounds, not a credit model. They exist so a judgment can
 * never produce terms outside what the pool is willing to bear, and so evidence
 * that cannot be trusted is refused without spending a model call.
 *
 * The line between this file and the underwriter matters. Everything here is
 * about whether evidence is *usable* and what terms are *permissible*. Nothing
 * here decides whether a record is *good*. The moment a threshold in this file
 * starts judging quality, the underwriter has collapsed into a formula and T13
 * is lost.
 */
export const UNDERWRITING_ENVELOPE = {
  /** No line may exceed this, whatever the judgment says. In tCTC. */
  maxCreditLimit: '2.0',

  /** Collateral floor as a fraction of the limit. The judge may demand more. */
  minCollateralRatio: 0.15,

  /** Rate band in basis points. The judge may price higher within it. */
  minRateBps: 300,
  maxRateBps: 3000,

  /**
   * Evidence older than this is not underwritable. Matches the credit line's
   * own staleness freeze so the two cannot disagree.
   */
  maxEvidenceAgeDays: 3,

  /** Below this there is no record to read, so there is nothing to judge. */
  minFeedbackEntries: 1,
} as const;
