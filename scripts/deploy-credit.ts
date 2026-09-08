/**
 * Deploys the Phase 2 credit core to Creditcoin CC3 and wires it up.
 *
 * Redeploys AssayOracle too, because Phase 2 added the identity-transfer and
 * wallet-change evidence the freeze triggers read. Evidence proved against an
 * older oracle does not carry over, so re-prove after this runs.
 *
 * T7: every send applies GAS_LIMIT_MULTIPLIER rather than trusting the estimate.
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { CREDITCOIN, GAS_LIMIT_MULTIPLIER } from '../config/chains';
import { CREDIT_PARAMS } from '../config/demo';

function artifact(name: string): { abi: ethers.InterfaceAbi; bytecode: string } {
  const raw = JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, 'utf8'));
  return { abi: raw.abi, bytecode: raw.bytecode.object };
}

async function deploy(
  name: string,
  wallet: ethers.Wallet,
  args: unknown[] = []
): Promise<ethers.BaseContract> {
  const { abi, bytecode } = artifact(name);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.getDeployTransaction(...args);
  const estimate = await wallet.provider!.estimateGas({ ...deployTx, from: wallet.address });
  const gasLimit = (estimate * BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100))) / 100n;

  const contract = await factory.deploy(...args, { gasLimit });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ${name.padEnd(12)} ${address}  (gas est ${estimate})`);
  return contract;
}

async function send(label: string, promise: Promise<ethers.ContractTransactionResponse>): Promise<void> {
  const tx = await promise;
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} reverted`);
  console.log(`  ${label.padEnd(24)} ${receipt.hash}`);
}

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const wallet = new ethers.Wallet(key, provider);
  console.log(`Deployer ${wallet.address}\n`);

  console.log('Deploying:');
  const oracle = await deploy('AssayOracle', wallet);
  const pool = await deploy('LendingPool', wallet);
  const credit = await deploy('CreditLine', wallet, [
    await pool.getAddress(),
    await oracle.getAddress(),
    CREDIT_PARAMS.evidenceMaxAgeBlocks,
  ]);

  console.log('\nWiring:');
  const poolWritable = pool as ethers.BaseContract & Record<string, ethers.ContractMethod>;
  const creditWritable = credit as ethers.BaseContract & Record<string, ethers.ContractMethod>;
  await send('pool.setCreditLine', poolWritable.setCreditLine(await credit.getAddress()));
  await send('credit.setUnderwriter', creditWritable.setUnderwriter(wallet.address));

  console.log('\nUpdate config/deployments.ts with:');
  console.log(`  assayOracle: '${await oracle.getAddress()}',`);
  console.log(`  lendingPool: '${await pool.getAddress()}',`);
  console.log(`  creditLine:  '${await credit.getAddress()}',`);
  console.log(`\nEvidence max age: ${CREDIT_PARAMS.evidenceMaxAgeBlocks} blocks`);
  console.log('Next: re-prove agent evidence against the new oracle.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
