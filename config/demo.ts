/**
 * Demo fixtures. Rule 5: demo numbers live here, never inline in a script.
 */

/**
 * The agent card for Assay's demo agent, in the EIP-8004 registration-v1 shape
 * observed on Sepolia. Stored inline as a data URI so the identity resolves
 * without us hosting anything, which keeps the demo reproducible.
 */
export const DEMO_AGENT_CARD = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: 'Assay Demo Borrower',
  description:
    'Testnet-only demo agent for Assay, an underwriter that proves ERC-8004 work history from Ethereum onto Creditcoin and extends a credit line against it.',
  active: true,
  services: [],
} as const;

export function demoAgentUri(): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify(DEMO_AGENT_CARD))}`;
}

/** Creditcoin CC3 produces a block every 15 seconds, measured 2026-09-08. */
export const CREDITCOIN_BLOCKS_PER_DAY = 5760;

/**
 * Credit parameters for the demo. Rule 5: these live here, never inline.
 *
 * `evidenceMaxAgeBlocks` is the fail-closed bound from rule 7. Once the newest
 * proof about an agent is older than this, the line stops trusting it and
 * freezes. Three days is a demo-friendly setting; a real deployment would run
 * tighter, and re-proving any event refreshes the clock.
 */
export const CREDIT_PARAMS = {
  evidenceMaxAgeBlocks: 3 * CREDITCOIN_BLOCKS_PER_DAY,
  /** Total the agent may draw, in tCTC. */
  limit: '2.0',
  /** Partial collateral the agent posts to activate the line, in tCTC. */
  collateral: '0.5',
  /** Fixed simple interest on each draw. 500 = 5%. */
  interestBps: 500,
  /** Line lifetime, in Creditcoin blocks. */
  durationBlocks: 7 * CREDITCOIN_BLOCKS_PER_DAY,
} as const;

/** Opening deposit from the demo lender, in tCTC. */
export const DEMO_POOL_DEPOSIT = '5.0';
