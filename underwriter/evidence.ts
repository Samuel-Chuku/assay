/**
 * Assembles the evidence bundle the underwriter judges.
 *
 * Everything here comes from AssayOracle on Creditcoin, which only holds facts
 * that survived the five checks and arrived through a verified cross-chain
 * proof. Nothing is read from Sepolia directly. That restriction is the point:
 * the underwriter must be unable to see anything that was not proven, so a
 * decision can never rest on data an attacker could fabricate.
 */
import { ethers } from 'ethers';

import { CREDITCOIN, SEPOLIA } from '../config/chains';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '../config/deployments';

export type ProvenFeedback = {
  client: string;
  /** Signed and scaled by `valueDecimals`. */
  value: number;
  valueDecimals: number;
  /** Per (agent, client) and 1-indexed, so a high number means a repeat payer. */
  feedbackIndex: number;
  tag1Hash: string;
  /** Whether this client holds an ERC-8004 identity we have also proven. */
  clientHoldsProvenIdentity: boolean;
};

export type EvidenceBundle = {
  agentId: number;
  proven: boolean;
  owner: string;
  currentOwner: string;
  paymentWallet: string;
  /** Creditcoin blocks. */
  provenAtBlock: number;
  lastEvidenceBlock: number;
  evidenceAgeBlocks: number;
  ownerChanges: number;
  walletChanges: number;
  feedback: ProvenFeedback[];
  /** Where every fact came from, so a verdict can cite its sources. */
  provenance: {
    oracle: string;
    chain: string;
    sourceChain: string;
    readAtBlock: number;
    proofTransactions: string[];
  };
};

const ORACLE_ABI = [
  'function getAgent(uint256) view returns (tuple(bool proven,address owner,address currentOwner,address paymentWallet,uint64 provenAtBlock,uint64 lastEvidenceBlock,uint32 feedbackCount,uint32 ownerChanges,uint32 walletChanges))',
  'function feedbackCount(uint256) view returns (uint256)',
  'function feedbackAt(uint256,uint256) view returns (tuple(address client,int128 value,uint8 valueDecimals,uint64 feedbackIndex,bytes32 tag1Hash))',
  'event AgentProven(uint256 indexed agentId, address indexed owner, bytes32 indexed queryId)',
  'event FeedbackProven(uint256 indexed agentId, address indexed client, bytes32 indexed queryId, uint64 feedbackIndex, int128 value, uint8 valueDecimals, bytes32 tag1Hash)',
];

export function oracleContract(provider: ethers.Provider): ethers.Contract {
  return new ethers.Contract(DEPLOYMENTS.assayOracle, ORACLE_ABI, provider);
}

/**
 * Every address that owns an identity we have proven.
 *
 * This is how counterparty standing is established without trusting anything
 * unproven (T10). A rater that appears here staked a registered identity to
 * leave its feedback. A rater that does not is an address and nothing more.
 */
async function provenIdentityOwners(oracle: ethers.Contract): Promise<Set<string>> {
  const logs = await oracle.queryFilter(oracle.filters.AgentProven(), ORACLE_DEPLOYED_AT_BLOCK, 'latest');
  const owners = new Set<string>();
  for (const log of logs) {
    const owner = (log as ethers.EventLog).args?.owner as string | undefined;
    if (owner) owners.add(owner.toLowerCase());
  }
  return owners;
}

async function proofTransactionsFor(oracle: ethers.Contract, agentId: number): Promise<string[]> {
  const [registrations, feedback] = await Promise.all([
    oracle.queryFilter(oracle.filters.AgentProven(agentId), ORACLE_DEPLOYED_AT_BLOCK, 'latest'),
    oracle.queryFilter(oracle.filters.FeedbackProven(agentId), ORACLE_DEPLOYED_AT_BLOCK, 'latest'),
  ]);
  return [...registrations, ...feedback].map((l) => l.transactionHash);
}

export async function gatherEvidence(agentId: number): Promise<EvidenceBundle> {
  const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const oracle = oracleContract(provider);

  const [record, readAtBlock, owners, proofTransactions] = await Promise.all([
    oracle.getAgent(agentId),
    provider.getBlockNumber(),
    provenIdentityOwners(oracle),
    proofTransactionsFor(oracle, agentId),
  ]);

  const count = Number(await oracle.feedbackCount(agentId));
  const feedback: ProvenFeedback[] = [];
  for (let i = 0; i < count; i++) {
    const entry = await oracle.feedbackAt(agentId, i);
    feedback.push({
      client: entry.client,
      value: Number(entry.value),
      valueDecimals: Number(entry.valueDecimals),
      feedbackIndex: Number(entry.feedbackIndex),
      tag1Hash: entry.tag1Hash,
      clientHoldsProvenIdentity: owners.has(String(entry.client).toLowerCase()),
    });
  }

  return {
    agentId,
    proven: record.proven,
    owner: record.owner,
    currentOwner: record.currentOwner,
    paymentWallet: record.paymentWallet,
    provenAtBlock: Number(record.provenAtBlock),
    lastEvidenceBlock: Number(record.lastEvidenceBlock),
    evidenceAgeBlocks: readAtBlock - Number(record.lastEvidenceBlock),
    ownerChanges: Number(record.ownerChanges),
    walletChanges: Number(record.walletChanges),
    feedback,
    provenance: {
      oracle: DEPLOYMENTS.assayOracle,
      chain: `Creditcoin CC3 (${CREDITCOIN.chainId})`,
      sourceChain: `Ethereum Sepolia (${SEPOLIA.chainId})`,
      readAtBlock,
      proofTransactions,
    },
  };
}
