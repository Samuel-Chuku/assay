/**
 * Phase 2 acceptance: offer a line, accept it, draw against it and repay it,
 * on Creditcoin CC3, against evidence that was proved from Sepolia.
 *
 * The deployer plays lender, underwriter and borrower here. That is a demo
 * limitation, not a design one: the contracts keep the roles separate and
 * Phase 5 seeds distinct actors.
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { CREDITCOIN, GAS_LIMIT_MULTIPLIER } from '../config/chains';
import { DEPLOYMENTS, DEMO_AGENT_ID } from '../config/deployments';
import { CREDIT_PARAMS, DEMO_POOL_DEPOSIT } from '../config/demo';

const STATES = ['None', 'Offered', 'Active', 'Frozen', 'Repaid', 'Defaulted'];
const FREEZE_REASONS = ['NotFrozen', 'IdentityTransferred', 'PaymentWalletChanged', 'EvidenceStale'];

function abiOf(name: string): ethers.InterfaceAbi {
  return JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, 'utf8')).abi;
}

async function send(label: string, call: Promise<ethers.ContractTransactionResponse>): Promise<string> {
  const tx = await call;
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} reverted`);
  console.log(`  ${label.padEnd(22)} ${receipt.hash}`);
  return receipt.hash;
}

/** T7: never trust the estimate on this chain. */
async function withBuffer(
  contract: ethers.BaseContract,
  method: string,
  args: unknown[],
  value = 0n
): Promise<{ gasLimit: bigint; value: bigint }> {
  const data = contract.interface.encodeFunctionData(method, args);
  const estimate = await contract.runner!.provider!.estimateGas({
    to: await contract.getAddress(),
    data,
    value,
    from: await (contract.runner as ethers.Wallet).getAddress(),
  });
  return { gasLimit: (estimate * BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100))) / 100n, value };
}

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const wallet = new ethers.Wallet(key, provider);

  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, abiOf('AssayOracle'), wallet);
  const pool = new ethers.Contract(DEPLOYMENTS.lendingPool, abiOf('LendingPool'), wallet);
  const credit = new ethers.Contract(DEPLOYMENTS.creditLine, abiOf('CreditLine'), wallet);

  const record = await oracle.getAgent(DEMO_AGENT_ID);
  if (!record.proven) throw new Error(`agent ${DEMO_AGENT_ID} not proved against this oracle`);

  const head = await provider.getBlockNumber();
  console.log(`Agent ${DEMO_AGENT_ID}, all of this proved from Sepolia:`);
  console.log(`  owner              ${record.currentOwner}`);
  console.log(`  evidence age       ${head - Number(record.lastEvidenceBlock)} blocks`);
  console.log(`  owner changes      ${record.ownerChanges}`);
  console.log(`  wallet changes     ${record.walletChanges}`);

  const limit = ethers.parseEther(CREDIT_PARAMS.limit);
  const collateral = ethers.parseEther(CREDIT_PARAMS.collateral);
  const deposit = ethers.parseEther(DEMO_POOL_DEPOSIT);
  const expiry = head + CREDIT_PARAMS.durationBlocks;

  // Phase 3 replaces this with the hash of the underwriter's written judgment.
  const reasoningHash = ethers.id('phase-2 acceptance run, mechanics only');

  console.log('\nPool:');
  if ((await pool.totalShares()) === 0n) {
    await send('deposit', pool.deposit(await withBuffer(pool, 'deposit', [], deposit)));
  } else {
    console.log('  already funded');
  }
  console.log(`  total assets           ${ethers.formatEther(await pool.totalAssets())} tCTC`);

  console.log('\nCredit line:');
  const existing = await credit.getLine(DEMO_AGENT_ID);
  if (Number(existing.state) === 0) {
    await send(
      'offer',
      credit.offer(DEMO_AGENT_ID, limit, collateral, CREDIT_PARAMS.interestBps, expiry, reasoningHash, {
        ...(await withBuffer(credit, 'offer', [
          DEMO_AGENT_ID,
          limit,
          collateral,
          CREDIT_PARAMS.interestBps,
          expiry,
          reasoningHash,
        ])),
      })
    );
    await send(
      'accept',
      credit.accept(DEMO_AGENT_ID, {
        ...(await withBuffer(credit, 'accept', [DEMO_AGENT_ID], collateral)),
      })
    );
  } else {
    console.log(`  line already in state ${STATES[Number(existing.state)]}`);
  }

  const drawAmount = limit / 2n;
  await send(
    'draw',
    credit.draw(DEMO_AGENT_ID, drawAmount, {
      ...(await withBuffer(credit, 'draw', [DEMO_AGENT_ID, drawAmount])),
    })
  );

  let line = await credit.getLine(DEMO_AGENT_ID);
  console.log(`  drawn                  ${ethers.formatEther(line.principalOutstanding)} tCTC`);
  console.log(`  interest owed          ${ethers.formatEther(line.interestOwed)} tCTC`);

  const owed = line.principalOutstanding + line.interestOwed;
  await send(
    'repay',
    credit.repay(DEMO_AGENT_ID, { ...(await withBuffer(credit, 'repay', [DEMO_AGENT_ID], owed)) })
  );

  line = await credit.getLine(DEMO_AGENT_ID);
  console.log('\nFinal state:');
  console.log(`  line state             ${STATES[Number(line.state)]}`);
  console.log(`  freeze reason          ${FREEZE_REASONS[Number(await credit.pendingFreezeReason(DEMO_AGENT_ID))]}`);
  console.log(`  principal outstanding  ${ethers.formatEther(line.principalOutstanding)} tCTC`);
  console.log(`  pool total assets      ${ethers.formatEther(await pool.totalAssets())} tCTC`);
  console.log(`\n  pool       ${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.lendingPool}`);
  console.log(`  creditLine ${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.creditLine}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
