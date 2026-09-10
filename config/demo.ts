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

/**
 * The demo cast on Sepolia.
 *
 * The Reputation Registry rejects feedback from anyone authorised over the agent
 * being rated, but that check is per agent, not global. So participants can rate
 * each other's agents and no pool of dedicated raters is needed.
 *
 * The point of the shape below is the contrast. `refused` carries better raw
 * numbers than `approved`, and every one of them comes from a single wallet that
 * holds no identity of its own. A formula that averages scores prefers it. A
 * reader that weighs counterparty breadth and standing does not. That is T13
 * made concrete, and it is the demo's best moment.
 *
 * Wallet 0 is the deployer. Wallets 1 to 5 are derived from it, see
 * `scripts/seed-sepolia.ts`.
 */
export const DEMO_WALLET_COUNT = 5;

/** Sepolia ETH sent to each derived wallet. Measured need is under a third of this. */
export const DEMO_WALLET_FUNDING = '0.004';

export const DEMO_CAST = {
  /** Owned by wallet 1. Rated by three distinct counterparties that each hold an identity. */
  approved: {
    ownerIndex: 1,
    name: 'Meridian Research Agent',
    description:
      'Testnet demo agent for Assay. Broad counterparty history across several distinct payers.',
  },
  /** Owned by wallet 2. Rated only by wallet 4, which holds no identity at all. */
  refused: {
    ownerIndex: 2,
    name: 'Halcyon Yield Agent',
    description:
      'Testnet demo agent for Assay. Numerically strong history concentrated in a single new counterparty.',
  },
  /** Owned by wallet 3. Exists so wallet 3 has standing when it rates others. */
  standing: {
    ownerIndex: 3,
    name: 'Corvus Audit Agent',
    description: 'Testnet demo agent for Assay. Acts as a counterparty with its own registered identity.',
  },
  /**
   * Owned by wallet 5. Underwritten and funded exactly like `approved`, then
   * its identity is deliberately sold on Sepolia so the T8 freeze trigger
   * fires against a live credit line. It exists so the freeze can be
   * demonstrated without destroying the healthy approval.
   */
  frozen: {
    ownerIndex: 5,
    name: 'Peregrine Logistics Agent',
    description:
      'Testnet demo agent for Assay. Underwritten on a real record, then its identity is transferred to show the credit line freeze.',
  },
} as const;

/**
 * Who rates whom. `value` is scaled by `valueDecimals`, so 92 at 2 decimals is
 * 0.92. Wallet 0 is the deployer.
 */
export const DEMO_FEEDBACK = {
  approved: [
    { raterIndex: 0, value: 88, tag1: 'delivery', tag2: 'onTime' },
    { raterIndex: 2, value: 92, tag1: 'quality', tag2: 'accurate' },
    { raterIndex: 3, value: 95, tag1: 'delivery', tag2: 'onTime' },
  ],
  refused: [
    { raterIndex: 4, value: 99, tag1: 'delivery', tag2: 'onTime' },
    { raterIndex: 4, value: 100, tag1: 'delivery', tag2: 'onTime' },
    { raterIndex: 4, value: 99, tag1: 'quality', tag2: 'excellent' },
    { raterIndex: 4, value: 98, tag1: 'delivery', tag2: 'onTime' },
    { raterIndex: 4, value: 100, tag1: 'quality', tag2: 'excellent' },
  ],
  /** Same shape as `approved`, so it earns a line worth freezing. */
  frozen: [
    { raterIndex: 0, value: 90, tag1: 'delivery', tag2: 'onTime' },
    { raterIndex: 2, value: 93, tag1: 'quality', tag2: 'accurate' },
    { raterIndex: 3, value: 91, tag1: 'delivery', tag2: 'onTime' },
  ],
} as const;

export const DEMO_FEEDBACK_DECIMALS = 2;

export function agentCardUri(name: string, description: string): string {
  const card = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description,
    active: true,
    services: [],
  };
  return `data:application/json,${encodeURIComponent(JSON.stringify(card))}`;
}
