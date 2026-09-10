/**
 * Watcher limits. Rule 5: tuned numbers live here, not in the loop.
 *
 * These exist because the watcher runs unattended holding a funded key. Every
 * value below is a bound on what a bad day can cost.
 */
export const WATCHER = {
  /** How often to look for new Sepolia activity. */
  pollSeconds: 60,

  /**
   * How far back to look on a first run with no saved state. Roughly a day of
   * Sepolia at 12s blocks — enough to catch recent work, small enough that
   * `eth_getLogs` returns.
   */
  coldStartBlocks: 7_200,

  /**
   * Blocks per scan. One bounded window per pass: an unbounded range is what
   * makes `eth_getLogs` time out on a free endpoint.
   */
  scanWindowBlocks: 2_000,

  /**
   * Proofs per UTC day. Each costs roughly 230k gas on Creditcoin, so this is
   * the ceiling on what an unattended wallet can spend before someone looks.
   */
  maxProofsPerDay: 60,

  /** Longest pause after repeated failures. */
  maxBackoffSeconds: 900,

  /**
   * Port for the read-only status server.
   *
   * The site is deployed separately and builds from git, so a verdict formed
   * here would otherwise never reach it: re-underwriting would keep happening
   * and nobody would see it. Serving the verdicts the watcher actually holds
   * closes that gap without putting a deploy in the loop of a credit decision.
   *
   * Bound to loopback. A reverse proxy is what faces the world.
   */
  statusPort: 8787,
} as const;
