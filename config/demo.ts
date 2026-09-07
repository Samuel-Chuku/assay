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
