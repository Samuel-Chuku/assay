/**
 * Seeds the Sepolia side of the demo: derives the cast's wallets, funds them
 * from the deployer, registers their agents, and writes the feedback history the
 * underwriter will later judge.
 *
 * Idempotent. Re-running skips anything already done, so a partial run can be
 * resumed without duplicating identities or feedback.
 *
 * Wallet keys are derived deterministically from the deployer key rather than
 * stored. These are throwaway testnet wallets holding a fraction of a Sepolia
 * ETH; adding four more secrets to .env would be worse than deriving them.
 *
 * Results land in config/demo-agents.json, which the proving and underwriting
 * steps read.
 */
import 'dotenv/config';

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { REGISTRIES, SEPOLIA } from '../config/chains';
import { IDENTITY_EVENTS } from '../config/events';
import {
  DEMO_CAST,
  DEMO_FEEDBACK,
  DEMO_FEEDBACK_DECIMALS,
  DEMO_WALLET_COUNT,
  DEMO_WALLET_FUNDING,
  agentCardUri,
} from '../config/demo';

const OUTPUT = 'config/demo-agents.json';

const IDENTITY_ABI = ['function register(string agentURI) external returns (uint256 agentId)'];
const REPUTATION_ABI = [
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external',
];

type Seed = {
  wallets: Record<number, string>;
  agents: Record<string, { agentId: number; owner: string; registrationTx: string }>;
  feedback: { agentKey: string; rater: string; value: number; tx: string }[];
};

function loadSeed(): Seed {
  if (existsSync(OUTPUT)) return JSON.parse(readFileSync(OUTPUT, 'utf8')) as Seed;
  return { wallets: {}, agents: {}, feedback: [] };
}

function saveSeed(seed: Seed): void {
  writeFileSync(OUTPUT, `${JSON.stringify(seed, null, 2)}\n`);
}

/** Deterministic throwaway keys, derived from the deployer key. Testnet only. */
function derive(deployerKey: string, index: number): ethers.Wallet {
  const material = ethers.solidityPackedKeccak256(
    ['bytes32', 'string', 'uint256'],
    [deployerKey, 'assay-demo-cast', index]
  );
  return new ethers.Wallet(material);
}

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  const deployerKey = key.startsWith('0x') ? key : `0x${key}`;

  const provider = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);

  const seed = loadSeed();
  const cast: Record<number, ethers.Wallet> = { 0: deployer };
  for (let i = 1; i <= DEMO_WALLET_COUNT; i++) {
    cast[i] = derive(deployerKey, i).connect(provider);
    seed.wallets[i] = cast[i].address;
  }
  seed.wallets[0] = deployer.address;
  saveSeed(seed);

  console.log('Cast:');
  for (const [i, w] of Object.entries(cast)) {
    const balance = await provider.getBalance(w.address);
    console.log(`  wallet ${i}  ${w.address}  ${ethers.formatEther(balance)} ETH`);
  }

  // ---------------------------------------------------------------- funding --
  console.log('\nFunding:');
  const target = ethers.parseEther(DEMO_WALLET_FUNDING);
  for (let i = 1; i <= DEMO_WALLET_COUNT; i++) {
    const balance = await provider.getBalance(cast[i].address);
    if (balance >= target / 2n) {
      console.log(`  wallet ${i}  already funded`);
      continue;
    }
    const tx = await deployer.sendTransaction({ to: cast[i].address, value: target });
    await tx.wait();
    console.log(`  wallet ${i}  ${ethers.formatEther(target)} ETH  ${tx.hash}`);
  }

  // ----------------------------------------------------------- registration --
  console.log('\nRegistering agents:');
  const registeredIface = new ethers.Interface([IDENTITY_EVENTS.registered.abi]);

  for (const [agentKey, spec] of Object.entries(DEMO_CAST)) {
    if (seed.agents[agentKey]) {
      console.log(`  ${agentKey.padEnd(9)} already registered as ${seed.agents[agentKey].agentId}`);
      continue;
    }
    const owner = cast[spec.ownerIndex];
    const registry = new ethers.Contract(REGISTRIES.identity, IDENTITY_ABI, owner);
    const tx = await registry.register(agentCardUri(spec.name, spec.description));
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${agentKey} registration reverted`);

    const parsed = receipt.logs
      .filter((l: ethers.Log) => l.topics[0] === IDENTITY_EVENTS.registered.topic0)
      .map((l: ethers.Log) => registeredIface.parseLog({ topics: [...l.topics], data: l.data }))
      .find((p: ethers.LogDescription | null) => p !== null);
    if (!parsed) throw new Error(`${agentKey}: no Registered event`);

    seed.agents[agentKey] = {
      agentId: Number(parsed.args.agentId),
      owner: owner.address,
      registrationTx: receipt.hash,
    };
    saveSeed(seed);
    console.log(`  ${agentKey.padEnd(9)} agentId ${parsed.args.agentId}  ${receipt.hash}`);
  }

  // --------------------------------------------------------------- feedback --
  console.log('\nWriting feedback:');
  for (const [agentKey, entries] of Object.entries(DEMO_FEEDBACK)) {
    const agent = seed.agents[agentKey];
    if (!agent) throw new Error(`${agentKey} not registered`);

    for (const entry of entries) {
      const rater = cast[entry.raterIndex];
      const already = seed.feedback.filter(
        (f) => f.agentKey === agentKey && f.rater === rater.address
      ).length;
      const wanted = entries.filter((e) => e.raterIndex === entry.raterIndex).indexOf(entry) + 1;
      if (already >= wanted) continue;

      const registry = new ethers.Contract(REGISTRIES.reputation, REPUTATION_ABI, rater);
      const tx = await registry.giveFeedback(
        agent.agentId,
        entry.value,
        DEMO_FEEDBACK_DECIMALS,
        entry.tag1,
        entry.tag2,
        'https://agent.example/a2a',
        '',
        ethers.ZeroHash
      );
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('giveFeedback reverted');

      seed.feedback.push({ agentKey, rater: rater.address, value: entry.value, tx: receipt.hash });
      saveSeed(seed);
      console.log(
        `  ${agentKey.padEnd(9)} agent ${agent.agentId} <- wallet ${entry.raterIndex} value ${entry.value}  ${receipt.hash}`
      );
    }
  }

  console.log(`\nSeed written to ${OUTPUT}`);
  console.log('Next: prove these transactions onto Creditcoin once attested.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
