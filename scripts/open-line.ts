/**
 * Opens the credit line the underwriter actually decided on.
 *
 * Terms come from config/verdicts.json rather than being typed in here, and the
 * verdict's `reasoningHash` is bound into the offer. That is what lets the site
 * prove the reasoning it displays is the reasoning the contract was given.
 *
 * Funds the borrower on Creditcoin first: the demo cast holds Sepolia ETH for
 * registering and rating, but nothing on the destination chain.
 *
 *   pnpm line:open <agentId>
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { CREDIT_LINE_ABI, ASSAY_ORACLE_ABI } from '../config/abi';
import { CREDITCOIN, GAS_LIMIT_MULTIPLIER } from '../config/chains';
import { DEPLOYMENTS } from '../config/deployments';
import { CREDIT_PARAMS } from '../config/demo';

const STATES = ['None', 'Offered', 'Active', 'Frozen', 'Repaid', 'Defaulted'];

type Verdict = {
  agentId: number;
  approve: boolean;
  credit_limit: string;
  collateral_ratio: number;
  rate_bps: number;
  reasoningHash: string;
};

/** Same derivation as scripts/seed-sepolia.ts. Testnet throwaways. */
function derive(deployerKey: string, index: number): ethers.Wallet {
  return new ethers.Wallet(
    ethers.solidityPackedKeccak256(
      ['bytes32', 'string', 'uint256'],
      [deployerKey, 'assay-demo-cast', index]
    )
  );
}

async function send(label: string, run: () => Promise<ethers.ContractTransactionResponse>): Promise<void> {
  const tx = await run();
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} reverted`);
  console.log(`  ${label.padEnd(22)} ${receipt.hash}`);
}

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  const deployerKey = key.startsWith('0x') ? key : `0x${key}`;

  const agentId = Number(process.argv[2]);
  if (!Number.isInteger(agentId)) throw new Error('usage: pnpm line:open <agentId>');

  const verdicts = JSON.parse(readFileSync('config/verdicts.json', 'utf8')) as Verdict[];
  const verdict = verdicts.find((v) => v.agentId === agentId);
  if (!verdict) throw new Error(`no verdict for agent ${agentId} — run pnpm verdicts:export`);
  if (!verdict.approve) throw new Error(`agent ${agentId} was refused; there is no line to open`);

  const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);
  const credit = new ethers.Contract(DEPLOYMENTS.creditLine, CREDIT_LINE_ABI, deployer);
  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, provider);

  const record = await oracle.getAgent(agentId);
  if (!record.proven) throw new Error(`agent ${agentId} is not proven on this oracle`);

  const limit = ethers.parseEther(verdict.credit_limit);
  const collateral = (limit * BigInt(Math.round(verdict.collateral_ratio * 10_000))) / 10_000n;
  const head = await provider.getBlockNumber();
  const expiry = head + CREDIT_PARAMS.durationBlocks;

  console.log(`Agent ${agentId}, terms straight from the verdict:`);
  console.log(`  borrower    ${record.currentOwner}`);
  console.log(`  limit       ${ethers.formatEther(limit)} tCTC`);
  console.log(`  collateral  ${ethers.formatEther(collateral)} tCTC (${verdict.collateral_ratio})`);
  console.log(`  rate        ${verdict.rate_bps} bps`);
  console.log(`  reasoning   ${verdict.reasoningHash}`);

  // Which derived wallet owns this agent?
  let borrower: ethers.Wallet | null = null;
  for (let i = 1; i <= 4; i++) {
    const candidate = derive(deployerKey, i);
    if (candidate.address.toLowerCase() === String(record.currentOwner).toLowerCase()) {
      borrower = candidate.connect(provider) as ethers.Wallet;
      break;
    }
  }
  if (!borrower) throw new Error(`the owner ${record.currentOwner} is not one of the demo cast wallets`);

  // The cast holds Sepolia ETH but nothing on Creditcoin.
  const needed = collateral + ethers.parseEther('0.5');
  const balance = await provider.getBalance(borrower.address);
  console.log('\nFunding:');
  if (balance < needed) {
    const topUp = needed - balance;
    const tx = await deployer.sendTransaction({ to: borrower.address, value: topUp });
    await tx.wait();
    console.log(`  borrower topped up   ${ethers.formatEther(topUp)} tCTC  ${tx.hash}`);
  } else {
    console.log('  borrower already funded');
  }

  const existing = await credit.getLine(agentId);
  console.log('\nCredit line:');
  if (Number(existing.state) !== 0) {
    console.log(`  already in state ${STATES[Number(existing.state)]}, leaving it alone`);
    return;
  }

  const buffer = BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100));
  const offerArgs = [
    agentId,
    limit,
    collateral,
    verdict.rate_bps,
    expiry,
    verdict.reasoningHash,
  ] as const;
  const offerGas = await credit.offer.estimateGas(...offerArgs);
  await send('offer', () => credit.offer(...offerArgs, { gasLimit: (offerGas * buffer) / 100n }));

  const asBorrower = credit.connect(borrower) as ethers.Contract;
  const acceptGas = await asBorrower.accept.estimateGas(agentId, { value: collateral });
  await send('accept', () =>
    asBorrower.accept(agentId, { value: collateral, gasLimit: (acceptGas * buffer) / 100n })
  );

  const draw = limit / 2n;
  const drawGas = await asBorrower.draw.estimateGas(agentId, draw);
  await send('draw', () => asBorrower.draw(agentId, draw, { gasLimit: (drawGas * buffer) / 100n }));

  const line = await credit.getLine(agentId);
  console.log('\nNow:');
  console.log(`  state       ${STATES[Number(line.state)]}`);
  console.log(`  drawn       ${ethers.formatEther(line.principalOutstanding)} tCTC`);
  console.log(`  interest    ${ethers.formatEther(line.interestOwed)} tCTC`);
  console.log(`  explorer    ${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.creditLine}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
