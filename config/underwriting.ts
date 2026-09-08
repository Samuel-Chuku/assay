/**
 * Underwriting configuration: where judgment is sourced, and the bounds it must
 * stay inside.
 */

/**
 * The judgment layer is configuration, not code. Endpoint, model and credential
 * all come from the environment, so Assay is tied to no single provider.
 * Anything speaking the standard chat-completions shape works.
 *
 * Cost is not a reason to choose badly. The dossier is ~1,500 tokens in and
 * ~800 out, and verdicts are cached by evidence hash, so a full demo is four
 * calls. Across the plausible range that is cents either way. Choose on
 * judgment quality and confirm it with `pnpm underwrite:qualify`.
 */
export const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';

export const LLM_MODEL = process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-5';

/**
 * Pinning temperature to zero does not make a judgment reproducible, but it
 * removes the cheapest source of run-to-run drift. Endpoints that ignore it
 * are unaffected.
 */
export const LLM_TEMPERATURE = 0;

/**
 * The deterministic envelope around the judgment.
 *
 * These are policy bounds, not a credit model. They exist so a judgment can
 * never produce terms outside what the pool is willing to bear, and so evidence
 * that cannot be trusted is refused without spending a call.
 *
 * The line matters. Everything here is about whether evidence is *usable* and
 * what terms are *permissible*. Nothing here decides whether a record is
 * *good*. The moment a threshold here starts judging quality, the underwriter
 * has collapsed into a formula and T13 is lost.
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
