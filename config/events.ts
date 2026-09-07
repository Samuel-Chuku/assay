/**
 * ERC-8004 event signatures, derived from the chain rather than from a spec.
 *
 * Method, 2026-09-07: scanned 40,000 blocks of real logs from both registries
 * on Sepolia (`pnpm tsx scripts/scan-registry-events.ts`), resolved each topic0
 * seen, pulled the verified implementation source behind each ERC-1967 proxy,
 * then confirmed every hash below with `cast keccak`. All five events observed
 * on chain matched. Do not edit a hash by hand; re-run the scan.
 *
 * Implementations behind the proxies, 2026-09-07:
 *   Identity   0x8004A818... -> 0x7274e874ca62410a93bd8bf61c69d8045e399c02
 *   Reputation 0x8004B663... -> 0x16e0fa7f7c56b9a767e34b192b51f921be31da34
 * They are upgradeable (UUPS), so an upgrade can change these. Re-run the scan
 * before trusting an old decision.
 */

/** Identity Registry. An ERC-721, so it emits Transfer as well. */
export const IDENTITY_EVENTS = {
  /** Registered(uint256 indexed agentId, string agentURI, address indexed owner) */
  registered: {
    signature: 'Registered(uint256,string,address)',
    topic0: '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a',
    abi: 'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
    /** topics[1] agentId, topics[2] owner, data (string agentURI) */
  },
  /** URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy) */
  uriUpdated: {
    signature: 'URIUpdated(uint256,string,address)',
    topic0: '0x3a2c7fffc2cba7582c690e3b82c453ea02a308326a98a3ad7576c606336409fb',
    abi: 'event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)',
  },
  /**
   * MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey,
   *             string metadataKey, bytes metadataValue)
   * topics[1] agentId, topics[2] keccak256(metadataKey),
   * data (string metadataKey, bytes metadataValue)
   */
  metadataSet: {
    signature: 'MetadataSet(uint256,string,string,bytes)',
    topic0: '0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b',
    abi: 'event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)',
  },
  /** ERC-721 Transfer. topics[3] is the agentId. This is the T8 trigger. */
  transfer: {
    signature: 'Transfer(address,address,uint256)',
    topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    abi: 'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  },
} as const;

/** Reputation Registry. Feedback is permissionless (T10). */
export const REPUTATION_EVENTS = {
  /**
   * NewFeedback(uint256 indexed agentId, address indexed clientAddress,
   *   uint64 feedbackIndex, int128 value, uint8 valueDecimals,
   *   string indexed indexedTag1, string tag1, string tag2,
   *   string endpoint, string feedbackURI, bytes32 feedbackHash)
   *
   * topics[1] agentId, topics[2] clientAddress, topics[3] keccak256(tag1).
   * Non-indexed, in ABI order:
   *   (uint64 feedbackIndex, int128 value, uint8 valueDecimals,
   *    string tag1, string tag2, string endpoint, string feedbackURI,
   *    bytes32 feedbackHash)
   */
  newFeedback: {
    signature:
      'NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)',
    topic0: '0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc',
    abi: 'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  },
  /** Feedback can be taken back. Proving a NewFeedback does not prove it stands. */
  feedbackRevoked: {
    signature: 'FeedbackRevoked(uint256,address,uint64)',
    topic0: '0x25156fd3288212246d8b008d5921fde376c71ed14ac2e072a506eb06fde6d09d',
    abi: 'event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)',
  },
  responseAppended: {
    signature: 'ResponseAppended(uint256,address,uint64,address,string,bytes32)',
    topic0: '0xb1c6be0b5b8aef6539e2fac0fd131a2faa7b49edf8e505b5eb0ad487d56051d4',
    abi: 'event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseURI, bytes32 responseHash)',
  },
} as const;

/**
 * The payment wallet is not its own event. `setAgentWallet` writes reserved
 * metadata and emits MetadataSet with this key, so a wallet change is detected
 * as MetadataSet where topics[2] equals this hash. That is the T9 trigger.
 * `keccak256("agentWallet")`, confirmed with `cast keccak`.
 */
export const AGENT_WALLET_KEY_HASH =
  '0x2ac6109326e720d1435c0db66f7e35eda7839f52b6f1f5520a60788e132b4e39';
