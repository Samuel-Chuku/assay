/**
 * Phase 1: register a demo agent on the Sepolia Identity Registry, so a real
 * Registered event exists for us to prove onto Creditcoin.
 *
 * Writes to a registry we do not control. That is the point: the event Assay
 * later proves is emitted by ERC-8004, not by us.
 */
import 'dotenv/config';

import { ethers } from 'ethers';

import { REGISTRIES, SEPOLIA } from '../config/chains';
import { IDENTITY_EVENTS } from '../config/events';
import { demoAgentUri } from '../config/demo';

const IDENTITY_ABI = ['function register(string agentURI) external returns (uint256 agentId)'];

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const wallet = new ethers.Wallet(key, provider);
  const registry = new ethers.Contract(REGISTRIES.identity, IDENTITY_ABI, wallet);

  const uri = demoAgentUri();
  console.log(`Registering as ${wallet.address}`);
  console.log(`Identity Registry ${REGISTRIES.identity}`);
  console.log(`agentURI (${uri.length} chars): ${uri.slice(0, 80)}...`);

  const tx = (await registry.register(uri)) as ethers.ContractTransactionResponse;
  console.log(`\nSubmitted ${tx.hash}, waiting for inclusion...`);
  const receipt: ethers.ContractTransactionReceipt | null = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('registration reverted');

  const iface = new ethers.Interface([IDENTITY_EVENTS.registered.abi]);
  const registered = receipt.logs
    .filter((l) => l.address.toLowerCase() === REGISTRIES.identity.toLowerCase())
    .filter((l) => l.topics[0] === IDENTITY_EVENTS.registered.topic0)
    .map((l) => iface.parseLog({ topics: [...l.topics], data: l.data }))
    .find((p) => p !== null);

  if (!registered) throw new Error('no Registered event in receipt');

  console.log(`\nRegistered`);
  console.log(`  agentId  ${registered.args.agentId}`);
  console.log(`  owner    ${registered.args.owner}`);
  console.log(`  tx       ${receipt.hash}`);
  console.log(`  block    ${receipt.blockNumber}`);
  console.log(`  explorer ${SEPOLIA.explorerUrl}/tx/${receipt.hash}`);
  console.log(`\nRecord agentId and block in STATE.md.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
