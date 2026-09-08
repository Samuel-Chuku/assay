/**
 * Deployed addresses. Rule 5: addresses live in config, never in a script or
 * a component. Update here when a contract is redeployed.
 *
 * Redeployed 2026-09-08 for Phase 2. The oracle gained the identity-transfer
 * and wallet-change evidence the freeze triggers read, so the Phase 1 instance
 * at 0x74f955C7b01Ad3649d50a93149b9ad9C5594c8b9 is superseded. Evidence proved
 * against it did not carry over and was re-proved.
 */
export const DEPLOYMENTS = {
  assayOracle: '0x76131b6547b584e9f101618239A26B2aCCd8aA43',
  lendingPool: '0x97343f59FC3F14945eDC3e8c6B3406C4E6bF15CD',
  creditLine: '0x210fb072cdcC034A691685Ea5ac14347D77A501c',
} as const;

/**
 * Block the oracle was deployed at.
 *
 * Creditcoin's RPC times out any `eth_getLogs` that takes over 10 seconds, and
 * the chain is past 5.4 million blocks, so scanning from genesis always fails.
 * Every log query starts here instead.
 */
export const ORACLE_DEPLOYED_AT_BLOCK = 5448907;

/** The demo agent whose ERC-8004 history Assay underwrites. */
export const DEMO_AGENT_ID = 10128;

/** The Sepolia transaction that registered the demo agent, for re-proving. */
export const DEMO_REGISTRATION_TX =
  '0xb904b1d7f41ec02f2de5223ee47c20251c4e34ecbeb7d5fcbf22e29671a38b35';
