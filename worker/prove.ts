/**
 * Proves one Sepolia transaction onto Creditcoin through AssayOracle.
 *
 * Usage: pnpm prove <sepolia-tx-hash> <registration|feedback>
 *
 * T3: attestation of a recent Sepolia block takes 8 to 10 minutes by design, so
 * the source chain can reorganise without invalidating an attestation. This
 * waits for the height to be attested rather than retrying a proof request
 * through failures.
 *
 * Rule 7, fail closed: if the attestation is not there, this stops. It never
 * falls back to reading Sepolia directly.
 *
 * adapted-from-examples: shared/utils/index.ts — the attestation wait and the
 * gas buffer approach. Rewritten, not imported.
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';

import { CREDITCOIN, SEPOLIA, GAS_LIMIT_MULTIPLIER } from '../config/chains';
import { DEPLOYMENTS } from '../config/deployments';

const ARTIFACT = 'contracts/out/AssayOracle.sol/AssayOracle.json';

/** Matches AssayOracle.Action. */
export const ACTIONS = { registration: 0, feedback: 1 } as const;
export type ActionName = keyof typeof ACTIONS;

const EXECUTE_SIGNATURE =
  'execute(uint8,uint64,uint64,bytes,bytes32,tuple(bytes32,bool)[],bytes32,bytes32[])';

export async function prove(txHash: string, actionName: ActionName): Promise<string> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const sepolia = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const creditcoin = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const wallet = new ethers.Wallet(key, creditcoin);

  const receipt = await sepolia.getTransactionReceipt(txHash);
  if (!receipt) throw new Error(`${txHash} not found on Sepolia`);
  if (receipt.status !== 1) throw new Error(`${txHash} reverted on Sepolia, nothing to prove`);
  const height = receipt.blockNumber;

  console.log(`Source tx    ${txHash}`);
  console.log(`Source block ${height}`);
  console.log(`Action       ${actionName} (${ACTIONS[actionName]})`);

  const info = new chainInfo.PrecompileChainInfoProvider(creditcoin);
  const latest = await info.getLatestAttestedHeightAndHash(SEPOLIA.sourceChainKey);
  const behind = height - Number(latest.height);
  console.log(`\nLatest attested height ${latest.height}, target is ${behind > 0 ? `${behind} blocks ahead` : 'already attested'}`);

  const builder = new proofProvider.service.ProofBuilder(SEPOLIA.sourceChainKey, CREDITCOIN.proofBuilderUrl);

  if (behind > 0) {
    console.log(`Waiting for attestation. This takes 8 to 10 minutes by design and cannot be tuned away.`);
  }
  await builder.waitUntilHeightAttested(SEPOLIA.sourceChainKey, height, 15_000, 1_200_000);
  console.log(`Block ${height} attested. Requesting proof...`);

  const result = await builder.getProof(txHash);
  if (!result.success || !result.data) {
    throw new Error(`proof builder failed: ${result.error ?? 'no data'}`);
  }
  const proof = result.data;
  console.log(`Proof ready. txIndex ${proof.txIndex}, continuity roots ${proof.continuityProof.roots.length}, cached ${proof.cached}`);

  const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, artifact.abi, wallet);

  const args = [
    ACTIONS[actionName],
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof.root,
    proof.merkleProof.siblings,
    proof.continuityProof.lowerEndpointDigest,
    proof.continuityProof.roots,
  ];

  const data = oracle.interface.encodeFunctionData(oracle.interface.getFunction(EXECUTE_SIGNATURE)!, args);

  // T7: estimation runs light on this chain. Buffer it, and if estimation
  // itself fails, fall back to a size-derived limit rather than guessing low.
  let gasLimit: bigint;
  try {
    const estimate = await creditcoin.estimateGas({ to: DEPLOYMENTS.assayOracle, data, from: wallet.address });
    gasLimit = (estimate * BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100))) / 100n;
    console.log(`Gas estimate ${estimate}, sending with ${gasLimit}`);
  } catch (error) {
    gasLimit = BigInt(21_000 + proof.continuityProof.roots.length * 5_000 + 400_000);
    console.warn(`Gas estimation failed (${(error as Error).message.slice(0, 60)}), using ${gasLimit}`);
  }

  const tx = await wallet.sendTransaction({ to: DEPLOYMENTS.assayOracle, data, gasLimit });
  console.log(`\nSubmitted ${tx.hash}, waiting...`);
  const submitted = await tx.wait();
  if (!submitted || submitted.status !== 1) throw new Error('proof submission reverted on Creditcoin');

  console.log(`\nProved`);
  console.log(`  gas used ${submitted.gasUsed}`);
  console.log(`  tx       ${submitted.hash}`);
  console.log(`  explorer ${CREDITCOIN.explorerUrl}/tx/${submitted.hash}`);

  for (const log of submitted.logs) {
    try {
      const parsed = oracle.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed) console.log(`  event    ${parsed.name}(${parsed.args.map(String).join(', ')})`);
    } catch {
      // logs from the precompile are not ours to decode
    }
  }

  return submitted.hash;
}

async function main(): Promise<void> {
  const [txHash, action] = process.argv.slice(2);
  if (!txHash || !(action in ACTIONS)) {
    throw new Error('usage: pnpm prove <sepolia-tx-hash> <registration|feedback>');
  }
  await prove(txHash, action as ActionName);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
