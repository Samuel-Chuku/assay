/**
 * Phase 1 research: what do the two ERC-8004 registries actually emit?
 * Dumps every distinct topic0 seen from each registry, with counts and a
 * sample, so the event signatures in config/events.ts are derived from the
 * chain rather than from a spec we hope matches the deployment.
 */
import 'dotenv/config';
import { ethers } from 'ethers';

import { REGISTRIES, SEPOLIA } from '../config/chains';

const CHUNK = 2000;
const RANGE = 40000;

async function scan(provider: ethers.JsonRpcProvider, label: string, address: string): Promise<void> {
  const head = await provider.getBlockNumber();
  const counts = new Map<string, number>();
  const samples = new Map<string, ethers.Log>();

  for (let to = head; to > head - RANGE; to -= CHUNK) {
    const from = Math.max(0, to - CHUNK + 1);
    try {
      for (const log of await provider.getLogs({ address, fromBlock: from, toBlock: to })) {
        const topic0 = log.topics[0];
        counts.set(topic0, (counts.get(topic0) ?? 0) + 1);
        if (!samples.has(topic0)) samples.set(topic0, log);
      }
    } catch (error) {
      console.log(`  chunk ${from}-${to} failed: ${(error as Error).message.slice(0, 70)}`);
    }
  }

  console.log(`\n=== ${label} ${address} — last ${RANGE} blocks to head ${head} ===`);
  if (counts.size === 0) {
    console.log('  no logs in range');
    return;
  }
  for (const [topic0, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const s = samples.get(topic0)!;
    console.log(`  ${topic0}`);
    console.log(`    seen ${n}x  topics=${s.topics.length}  dataBytes=${(s.data.length - 2) / 2}  block=${s.blockNumber}`);
    console.log(`    sample tx ${s.transactionHash}`);
  }
}

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  await scan(provider, 'Identity Registry', REGISTRIES.identity);
  await scan(provider, 'Reputation Registry', REGISTRIES.reputation);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
