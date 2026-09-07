/**
 * Deploys AssayOracle to Creditcoin CC3.
 *
 * T7: gas estimation on this chain runs light, so every send in Assay applies
 * GAS_LIMIT_MULTIPLIER rather than trusting the estimate.
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

import { CREDITCOIN, GAS_LIMIT_MULTIPLIER } from '../config/chains';

const ARTIFACT = 'contracts/out/AssayOracle.sol/AssayOracle.json';

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key?.trim()) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
  const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const wallet = new ethers.Wallet(key, provider);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
  const deployTx = await factory.getDeployTransaction();
  const estimate = await provider.estimateGas({ ...deployTx, from: wallet.address });
  const gasLimit = (estimate * BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100))) / 100n;

  console.log(`Deployer ${wallet.address}`);
  console.log(`Gas estimate ${estimate}, sending with limit ${gasLimit}`);

  const contract = await factory.deploy({ gasLimit });
  const tx = contract.deploymentTransaction();
  console.log(`\nSubmitted ${tx?.hash}, waiting...`);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nAssayOracle deployed`);
  console.log(`  address  ${address}`);
  console.log(`  tx       ${tx?.hash}`);
  console.log(`  explorer ${CREDITCOIN.explorerUrl}/address/${address}`);
  console.log(`\nAdd to .env as ASSAY_ORACLE_ADDRESS and record in STATE.md.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
