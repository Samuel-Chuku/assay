/**
 * Contract interfaces, in one place.
 *
 * Declared by hand rather than read from `contracts/out`, because the forge
 * artifacts are build output and are not committed. Anything that has to work
 * from a fresh clone — the web app especially — needs the interface without a
 * compile step.
 */

/** AssayOracle: the four evidence events, plus what is needed to read a proof back. */
export const ASSAY_ORACLE_ABI = [
  'event AgentProven(uint256 indexed agentId, address indexed owner, bytes32 indexed queryId)',
  'event FeedbackProven(uint256 indexed agentId, address indexed client, bytes32 indexed queryId, uint64 feedbackIndex, int128 value, uint8 valueDecimals, bytes32 tag1Hash)',
  'event IdentityTransferProven(uint256 indexed agentId, address indexed from, address indexed to, bytes32 queryId, uint32 ownerChanges)',
  'event WalletChangeProven(uint256 indexed agentId, address indexed newWallet, bytes32 indexed queryId, uint32 walletChanges)',

  /**
   * ASCBase's entry point. Decoding a submission's calldata is how the source
   * block and the merkle proof are recovered — the oracle does not store them,
   * because ASCBase never passes them to the handler.
   */
  'function execute(uint8 action, uint64 chainKey, uint64 blockHeight, bytes encodedTransaction, bytes32 merkleRoot, (bytes32 hash, bool isLeft)[] siblings, bytes32 lowerEndpointDigest, bytes32[] continuityRoots) returns (bool)',

  'function getAgent(uint256) view returns (tuple(bool proven, address owner, address currentOwner, address paymentWallet, uint64 provenAtBlock, uint64 lastEvidenceBlock, uint32 feedbackCount, uint32 ownerChanges, uint32 walletChanges))',
  'function feedbackCount(uint256) view returns (uint256)',
  'function feedbackAt(uint256,uint256) view returns (tuple(address client, int128 value, uint8 valueDecimals, uint64 feedbackIndex, bytes32 tag1Hash))',
] as const;

/**
 * The block-prover precompile at 0x0FD2.
 *
 * `calculateTxIndex` turns a merkle proof back into the transaction's index in
 * its source block. That index, with the block height from the submission's
 * calldata, is what resolves a proof to its Sepolia transaction hash — so the
 * link back to Ethereum is derived from what was proven, not from a side file.
 */
export const BLOCK_PROVER_ABI = [
  'function calculateTxIndex((bytes32 root, (bytes32 hash, bool isLeft)[] siblings)) view returns (uint64)',
] as const;

export const LENDING_POOL_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalShares() view returns (uint256)',
  'function totalDeployed() view returns (uint256)',
  'function shares(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function deposit() payable',
  'function withdraw(uint256 shareAmount)',
] as const;

export const CREDIT_LINE_ABI = [
  'function getLine(uint256) view returns (tuple(uint8 state, address borrower, uint256 limit, uint256 collateralRequired, uint256 collateralPosted, uint256 principalOutstanding, uint256 interestOwed, uint256 totalDrawn, uint16 interestBps, uint64 expiryBlock, uint32 ownerChangesAtOffer, uint32 walletChangesAtOffer, uint8 freezeReason, bytes32 reasoningHash))',
  'function pendingFreezeReason(uint256) view returns (uint8)',
  'function underwriter() view returns (address)',
  'function offer(uint256 agentId, uint256 limit, uint256 collateralRequired, uint16 interestBps, uint64 expiryBlock, bytes32 reasoningHash)',
  'function accept(uint256 agentId) payable',
  'function draw(uint256 agentId, uint256 amount)',
  'function repay(uint256 agentId) payable',
  'function freezeIfTriggered(uint256 agentId) returns (bool)',
] as const;
