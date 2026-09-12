/**
 * How a borrowing agent manages its own credit line.
 *
 * These are the agent's policy, not Assay's. Assay decides what an agent may
 * borrow; this decides when it chooses to. A different agent would run
 * different numbers, which is the point: the borrower is a separate party with
 * its own judgment, not a script the lender operates.
 */
export const BORROWER = {
  /** Below this, the agent cannot pay for its next job and draws. In tCTC. */
  lowWaterMark: 0.35,

  /** Above this, it is holding idle capital it is paying interest on. */
  highWaterMark: 1.2,

  /** Never draw less than this; a draw costs gas and should be worth making. */
  minDraw: 0.25,

  /** What a unit of work costs the agent: inference, gas, an API call. */
  jobCost: 0.12,

  /** What a client pays for that work. The margin is why borrowing is rational. */
  jobRevenue: 0.2,

  /**
   * How many ticks after a job its invoice is paid. This is the thesis in one
   * number: an agent pays for inference now and gets paid for the work later,
   * and that gap is what a credit line covers.
   */
  invoiceDelayTicks: 6,

  /**
   * A larger bill every so many jobs: model access, hosting, whatever a real
   * agent pays monthly. Costs are lumpy, and a lump is what pushes a healthy
   * agent back below its floor and onto its line again.
   */
  billEveryJobs: 12,
  billAmount: 0.8,

  /** Seconds between decisions. */
  tickSeconds: 45,

  /**
   * A ceiling on draws per run, so a bug in the loop above cannot empty the
   * line while nobody is watching. The same reasoning as the watcher's daily
   * proof ceiling.
   */
  maxDrawsPerRun: 4,
} as const;
