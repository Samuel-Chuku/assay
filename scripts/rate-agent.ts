/**
 * Leaves one fresh feedback entry for an agent, from one of the demo cast.
 *
 * Evidence expires: the envelope refuses anything older than three days, and
 * the credit line freezes on the same bound. That is correct behaviour, not a
 * problem to be worked around, but it means a demo left alone over a weekend
 * goes stale and its healthy agent stops being able to draw.
 *
 * This does not prove anything onto Creditcoin. It writes to the ERC-8004
 * registry on Ethereum and stops there; the watcher notices and proves it on
 * its own, about ten minutes later. Watching that happen is the point.
 *
 *   pnpm rate <agentId> <raterWalletIndex> [value]
 */
import 'dotenv/config';

import { ethers } from 'ethers';

import { REGISTRIES, SEPOLIA } from '../config/chains';
import { DEMO_WALLET_COUNT } from '../config/demo';

const REPUTATION_ABI = [
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external',
];

/** Same derivation as scripts/seed-sepolia.ts. Testnet throwaways. */
function derive(deployerKey: string, index: number): ethers.Wallet {
  return new ethers.Wallet(
    ethers.solidityPackedKeccak256(
      ['bytes32', 'string', 'uint256'],
      [deployerKey, 'assay-demo-cast', index]
    )
  );
}

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  const deployerKey = key.startsWith('0x') ? key : `0x${key}`;

  const agentId = Number(process.argv[2]);
  const raterIndex = Number(process.argv[3]);
  const value = Number(process.argv[4] ?? 0.94);

  if (!Number.isInteger(agentId) || !Number.isInteger(raterIndex)) {
    throw new Error('usage: pnpm rate <agentId> <raterWalletIndex> [value]');
  }
  if (raterIndex < 1 || raterIndex > DEMO_WALLET_COUNT) {
    throw new Error(`rater index must be 1..${DEMO_WALLET_COUNT}`);
  }
  if (value < 0 || value > 1) throw new Error('value must be between 0 and 1');

  const provider = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const rater = derive(deployerKey, raterIndex).connect(provider);
  const registry = new ethers.Contract(REGISTRIES.reputation, REPUTATION_ABI, rater);

  const balance = await provider.getBalance(rater.address);
  console.log(`Rater  ${rater.address}  (${ethers.formatEther(balance)} ETH)`);
  if (balance === 0n) throw new Error('rater has no Sepolia ETH; run pnpm seed:sepolia first');

  // Two decimals, matching how the cast was seeded, so the underwriter sees a
  // consistent scale rather than one entry in a different unit.
  const scaled = Math.round(value * 100);

  console.log(`Rating agent ${agentId} at ${value.toFixed(2)}...`);
  const tx = await registry.giveFeedback(
    agentId,
    scaled,
    2,
    'quality',
    '',
    '',
    '',
    ethers.ZeroHash
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('giveFeedback reverted');

  console.log(`\nWritten to Ethereum`);
  console.log(`  tx       ${receipt.hash}`);
  console.log(`  block    ${receipt.blockNumber}`);
  console.log(`  explorer ${SEPOLIA.explorerUrl}/tx/${receipt.hash}`);
  console.log(`\nNothing has been proven yet. The watcher will pick this up and prove it`);
  console.log(`onto Creditcoin once the block is attested, in roughly ten minutes.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
