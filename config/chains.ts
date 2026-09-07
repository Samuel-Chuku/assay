/**
 * Single source of truth for every address, chain constant and tuned number.
 * Values are transcribed from CLAUDE.md, which records them as verified against
 * live docs and a working Tutorial 1 run on 2026-09-07. Do not re-derive them
 * here and do not let a search result override them.
 */

/** Creditcoin CC3 testnet — the destination chain, where Assay lives. */
export const CREDITCOIN = {
  chainId: 102031,
  rpcUrl: process.env.CREDITCOIN_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network',
  explorerUrl: 'https://creditcoin-testnet.blockscout.com',
  currency: 'tCTC',
  /** BlockProver. Verifies source-chain proofs. */
  blockProverPrecompile: '0x0000000000000000000000000000000000000FD2',
  /** ChainInfo. Reports how far the attestor network has got. */
  chainInfoPrecompile: '0x0000000000000000000000000000000000000fd3',
  proofBuilderUrl: process.env.PROOF_BUILDER_URL ?? 'https://proof-gen-api.cc3-testnet.creditcoin.network/',
  /** Deployed EvmV1Decoder library, linked at deploy time. */
  decoderContract: '0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f',
} as const;

/**
 * Ethereum Sepolia — the source chain. The only one supported (T2).
 * No public RPC is pinned in CLAUDE.md, so this one must come from the
 * environment.
 */
export const SEPOLIA = {
  chainId: 11155111,
  rpcUrl: process.env.SOURCE_CHAIN_RPC_URL ?? '',
  explorerUrl: 'https://sepolia.etherscan.io',
  /** How Creditcoin's attestors key Sepolia. Genesis block 0. */
  sourceChainKey: 1,
} as const;

/**
 * The ERC-8004 registries on Sepolia. These two addresses are the entire
 * security model (T5): event signatures are public, so anyone can emit an
 * identical event with fabricated values and prove it to us. Trust comes from
 * *who* emitted a log, never from what it says. The ASC hardcodes these and
 * checks `log.address_` against them.
 */
export const REGISTRIES = {
  /** ERC-721. getAgentWallet(uint256), tokenURI(uint256). */
  identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
} as const;

/** The only emitters Assay will accept a proven log from. */
export const TRUSTED_EMITTERS = [REGISTRIES.identity, REGISTRIES.reputation] as const;

/**
 * Attestation lag is 8-10 minutes by design (T3), so the source chain can
 * reorganise without invalidating an attestation. Not tunable. The worker waits
 * this out before requesting a proof rather than polling through failures.
 */
export const ATTESTATION_WAIT_SECONDS = 600;

/**
 * Proof verification gas estimation runs light (T7). Tutorial 1 measured
 * 421,105 estimated against a 568,491 limit that worked, a factor of 1.35.
 */
export const GAS_LIMIT_MULTIPLIER = 1.35;
