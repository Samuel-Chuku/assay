/**
 * Sells an agent's ERC-8004 identity on Sepolia, to fire the T8 freeze trigger.
 *
 * This is the attack the contract exists to defend against: an agent builds a
 * record, borrows against it, then transfers the token to someone with no
 * history at all. The evidence that earned the credit no longer describes whoever
 * now holds the line.
 *
 * The registry clears the payment wallet on transfer, so a single transaction
 * emits both `Transfer` and `MetadataSet` — T8 and T9 fire together at the
 * source. Prove either onto Creditcoin and the line stops extending credit.
 *
 *   pnpm identity:sell <agentId> <buyerWalletIndex>
 */
import 'dotenv/config';

import { ethers } from 'ethers';

import { REGISTRIES, SEPOLIA } from '../config/chains';
import { DEMO_WALLET_COUNT } from '../config/demo';
import { IDENTITY_EVENTS } from '../config/events';

const IDENTITY_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function transferFrom(address from, address to, uint256 tokenId)',
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
  const buyerIndex = Number(process.argv[3]);
  if (!Number.isInteger(agentId) || !Number.isInteger(buyerIndex)) {
    throw new Error('usage: pnpm identity:sell <agentId> <buyerWalletIndex>');
  }
  if (buyerIndex < 0 || buyerIndex > DEMO_WALLET_COUNT) {
    throw new Error(`buyer index must be 0..${DEMO_WALLET_COUNT}`);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);
  const registry = new ethers.Contract(REGISTRIES.identity, IDENTITY_ABI, provider);

  const owner = (await registry.ownerOf(agentId)) as string;
  const buyer = buyerIndex === 0 ? deployer : derive(deployerKey, buyerIndex).connect(provider);

  console.log(`Agent ${agentId}`);
  console.log(`  current owner ${owner}`);
  console.log(`  buyer         ${buyer.address}`);

  if (owner.toLowerCase() === buyer.address.toLowerCase()) {
    throw new Error('the buyer already owns it; nothing would change');
  }

  // Find the seller among the cast so we can sign as them.
  let seller: ethers.Wallet | null = null;
  for (let i = 0; i <= DEMO_WALLET_COUNT; i++) {
    const candidate = i === 0 ? deployer : derive(deployerKey, i).connect(provider);
    if (candidate.address.toLowerCase() === owner.toLowerCase()) {
      seller = candidate as ethers.Wallet;
      break;
    }
  }
  if (!seller) throw new Error(`owner ${owner} is not one of the demo cast wallets`);

  const asSeller = registry.connect(seller) as ethers.Contract;
  const tx = await asSeller.transferFrom(owner, buyer.address, agentId);
  console.log(`\nSubmitted ${tx.hash}, waiting for inclusion...`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('transfer reverted');

  const emitted = receipt.logs
    .filter((l: ethers.Log) => l.address.toLowerCase() === REGISTRIES.identity.toLowerCase())
    .map((l: ethers.Log) =>
      l.topics[0] === IDENTITY_EVENTS.transfer.topic0
        ? 'Transfer'
        : l.topics[0] === IDENTITY_EVENTS.metadataSet.topic0
          ? 'MetadataSet (agentWallet cleared)'
          : null
    )
    .filter(Boolean);

  console.log(`\nSold`);
  console.log(`  tx       ${receipt.hash}`);
  console.log(`  block    ${receipt.blockNumber}`);
  console.log(`  explorer ${SEPOLIA.explorerUrl}/tx/${receipt.hash}`);
  console.log(`  events   ${emitted.join(', ')}`);
  console.log(
    `\nBoth T8 and T9 fired in one transaction. Prove it with:\n  pnpm prove ${receipt.hash} transfer`
  );
  console.log('Or leave the watcher to pick it up on its own.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
