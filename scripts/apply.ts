/**
 * Apply to Assay, as an agent, without asking anyone.
 *
 * There is no allow-list and no application form. An agent joins by proving its
 * own ERC-8004 registration onto Creditcoin, paying its own gas. That single
 * transaction is the whole onboarding: `AssayOracle` has no access control, and
 * the watcher tracks every agent the oracle has ever seen a registration for,
 * without caring who submitted it.
 *
 * The economics are the gate. Proving costs the applicant a little tCTC, which
 * is why a registry full of strangers cannot drain our wallet, and why we do not
 * have to watch every identity on Ethereum to be open to all of them.
 *
 * After this runs:
 *
 *   - the watcher notices the agent on its next pass and starts proving its
 *     feedback, transfers and wallet changes at our cost, not the agent's
 *   - the underwriter will read whatever record accumulates
 *   - a line still has to be offered, and only the underwriter address can do
 *     that. That is the one part of this that is not yet permissionless.
 *
 *   AGENT_PRIVATE_KEY=0x… pnpm apply <sepolia-registration-tx>
 */
import 'dotenv/config';

import { ethers } from 'ethers';

import { ASSAY_ORACLE_ABI } from '../config/abi';
import { CREDITCOIN, REGISTRIES, SEPOLIA } from '../config/chains';
import { DEPLOYMENTS } from '../config/deployments';
import { IDENTITY_EVENTS } from '../config/events';
import { prove } from '../worker/prove';

async function main(): Promise<void> {
  const txHash = process.argv[2];
  if (!txHash?.startsWith('0x')) {
    throw new Error('usage: AGENT_PRIVATE_KEY=0x… pnpm apply <sepolia-registration-tx>');
  }

  const raw = process.env.AGENT_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!raw?.trim()) {
    throw new Error(
      'Set AGENT_PRIVATE_KEY to the key that will pay for the proof. It never leaves this machine.'
    );
  }
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;

  const sepolia = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const creditcoin = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const wallet = new ethers.Wallet(key, creditcoin);

  // Check the transaction is what the applicant thinks it is, before spending
  // anything. A proof of the wrong transaction still costs gas.
  const receipt = await sepolia.getTransactionReceipt(txHash);
  if (!receipt) throw new Error(`${txHash} not found on Sepolia`);
  if (receipt.status !== 1) throw new Error(`${txHash} reverted; there is nothing to prove`);

  const registered = receipt.logs.find(
    (l) =>
      l.address.toLowerCase() === REGISTRIES.identity.toLowerCase() &&
      l.topics[0] === IDENTITY_EVENTS.registered.topic0
  );
  if (!registered) {
    throw new Error(
      `${txHash} contains no Registered event from the ERC-8004 Identity Registry. Apply with the transaction that registered the agent.`
    );
  }

  const parsed = new ethers.Interface([IDENTITY_EVENTS.registered.abi]).parseLog({
    topics: [...registered.topics],
    data: registered.data,
  });
  const agentId = Number(parsed!.args.agentId);
  const owner = String(parsed!.args.owner);

  const oracle = new ethers.Contract(DEPLOYMENTS.assayOracle, ASSAY_ORACLE_ABI, creditcoin);
  const existing = await oracle.getAgent(agentId);
  if (existing.proven) {
    console.log(`Agent ${agentId} is already proven on Assay. Nothing to do.`);
    console.log(`  ${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.assayOracle}`);
    return;
  }

  const balance = await creditcoin.getBalance(wallet.address);
  console.log(`Applying as agent ${agentId}`);
  console.log(`  owner on Ethereum   ${owner}`);
  console.log(`  paying from         ${wallet.address}`);
  console.log(`  balance             ${ethers.formatEther(balance)} tCTC`);
  if (balance === 0n) {
    throw new Error(
      'This wallet holds no tCTC on Creditcoin and cannot pay for the proof. Fund it from the Creditcoin Discord faucet.'
    );
  }
  console.log('');

  const hash = await prove(txHash, 'registration', key);

  console.log('');
  console.log(`Agent ${agentId} is now proven on Assay.`);
  console.log(`  proof ${CREDITCOIN.explorerUrl}/tx/${hash}`);
  console.log('');
  console.log('From here the watcher tracks this agent on its own, and proves its');
  console.log('feedback at our expense rather than yours. Get rated by clients on');
  console.log('Ethereum and the record builds itself.');
  console.log('');
  console.log('Assay will not offer a line until there is a record to read: at least');
  console.log('one proven feedback entry, no ownership or wallet change since, and');
  console.log('nothing older than three days.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
