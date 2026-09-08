/**
 * Proves the seeded Sepolia history onto Creditcoin, in the order the oracle
 * requires: every identity first, then the feedback written against it.
 *
 * Idempotent. Anything already proven is skipped, so this can be re-run after
 * an interruption without burning gas on duplicates.
 *
 * T3: the first pass will wait out attestation for the newest blocks. Later
 * passes are immediate, because an attested block proves straight from cache.
 */
import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { CREDITCOIN } from '../config/chains';
import { DEPLOYMENTS } from '../config/deployments';
import { prove, type ActionName } from '../worker/prove';

type Seed = {
  agents: Record<string, { agentId: number; owner: string; registrationTx: string }>;
  feedback: { agentKey: string; rater: string; value: number; tx: string }[];
  /** Source transactions already proven onto Creditcoin. Makes re-runs free. */
  proven?: string[];
};

const SEED_PATH = 'config/demo-agents.json';

const ORACLE_ABI = [
  'function getAgent(uint256) view returns (tuple(bool proven,address owner,address currentOwner,address paymentWallet,uint64 provenAtBlock,uint64 lastEvidenceBlock,uint32 feedbackCount,uint32 ownerChanges,uint32 walletChanges))',
];

async function main(): Promise<void> {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as Seed;
  seed.proven ??= [];
  const proven = new Set(seed.proven);
  const remember = (tx: string): void => {
    if (proven.has(tx)) return;
    proven.add(tx);
    seed.proven = [...proven];
    writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);
  };
  const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ORACLE_ABI, provider);

  const jobs: { label: string; tx: string; action: ActionName }[] = [];

  for (const [agentKey, agent] of Object.entries(seed.agents)) {
    const record = await oracle.getAgent(agent.agentId);
    if (record.proven) {
      console.log(`skip  ${agentKey} (${agent.agentId}) identity already proven`);
      remember(agent.registrationTx);
      continue;
    }
    jobs.push({ label: `${agentKey} identity`, tx: agent.registrationTx, action: 'registration' });
  }

  // Identities must land before any feedback against them.
  for (const entry of seed.feedback) {
    if (proven.has(entry.tx)) {
      console.log(`skip  ${entry.agentKey} feedback ${entry.value} already proven`);
      continue;
    }
    jobs.push({ label: `${entry.agentKey} feedback ${entry.value}`, tx: entry.tx, action: 'feedback' });
  }

  console.log(`\n${jobs.length} proof(s) to submit\n`);

  let done = 0;
  for (const job of jobs) {
    console.log(`--- ${job.label} ---`);
    try {
      await prove(job.tx, job.action);
      remember(job.tx);
      done++;
    } catch (error) {
      const message = (error as Error).message;
      // Re-running is normal. Estimation now refuses before spending gas, so an
      // already-proven entry lands here rather than in a reverted transaction.
      if (
        message.includes('Query already processed') ||
        message.includes('already submitted') ||
        message.includes('No new NewFeedback')
      ) {
        console.log('  already proven, recording and moving on');
        remember(job.tx);
        continue;
      }
      throw error;
    }
    console.log('');
  }

  console.log(`\nSubmitted ${done} proof(s).`);
  for (const [agentKey, agent] of Object.entries(seed.agents)) {
    const record = await oracle.getAgent(agent.agentId);
    console.log(
      `  ${agentKey.padEnd(9)} agent ${agent.agentId}  proven ${record.proven}  feedback ${record.feedbackCount}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
