/**
 * Creates a brand-new agent: a fresh wallet, funded, with an ERC-8004 identity.
 *
 * This is the "someone else" in a demo. The wallet is random, not derived from
 * anything we hold, so after this script exits the only place its key exists is
 * the line it prints. Save it: apply and borrow need it.
 *
 * Two ways to run it:
 *
 *   AGENT_PRIVATE_KEY=0x… pnpm agent:new "<name>"
 *     Registers with a wallet you already hold and have funded. This is the
 *     outsider's path: nothing of ours is needed on the machine running it.
 *
 *   pnpm agent:new "<name>"
 *     Creates a wallet and funds it from the deployer. This is us playing the
 *     faucet, because a fresh testnet wallet has to get its first coins from
 *     somewhere. Prints the key; it is the only copy.
 */
import 'dotenv/config';

import { ethers } from 'ethers';

import { CREDITCOIN, REGISTRIES, SEPOLIA } from '../config/chains';
import { IDENTITY_EVENTS } from '../config/events';

async function main(): Promise<void> {
  const name = process.argv[2] ?? 'New Agent';
  const sep = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const cc = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);

  let agent: ethers.Wallet | ethers.HDNodeWallet;
  const own = process.env.AGENT_PRIVATE_KEY?.trim();

  if (own) {
    // The outsider's path: a wallet it already holds and has funded itself.
    agent = new ethers.Wallet(own.startsWith('0x') ? own : `0x${own}`);
    const [eth, ctc] = await Promise.all([sep.getBalance(agent.address), cc.getBalance(agent.address)]);
    console.log(`Wallet        ${agent.address}`);
    console.log(`Holds         ${ethers.formatEther(eth)} ETH on Sepolia, ${ethers.formatEther(ctc)} tCTC on Creditcoin`);
    if (eth === 0n) throw new Error('No Sepolia ETH to pay for registration. Fund the wallet first.');
  } else {
    // Our path: play the faucet for a wallet that does not exist yet.
    const raw = process.env.DEPLOYER_PRIVATE_KEY?.trim();
    if (!raw) throw new Error('Set AGENT_PRIVATE_KEY to register a wallet you hold, or DEPLOYER_PRIVATE_KEY to create and fund one.');
    const root = raw.startsWith('0x') ? raw : `0x${raw}`;
    const funderSep = new ethers.Wallet(root, sep);
    const funderCc = new ethers.Wallet(root, cc);

    agent = ethers.Wallet.createRandom();
    console.log(`New wallet    ${agent.address}`);

    const gasSep = ethers.parseEther('0.004');
    const capital = ethers.parseEther('2.0');
    let t = await funderSep.sendTransaction({ to: agent.address, value: gasSep });
    await t.wait();
    console.log(`Sepolia gas   ${ethers.formatEther(gasSep)} ETH   ${t.hash.slice(0, 12)}…`);
    t = await funderCc.sendTransaction({ to: agent.address, value: capital });
    await t.wait();
    console.log(`Capital       ${ethers.formatEther(capital)} tCTC  ${t.hash.slice(0, 12)}…`);
  }

  const registry = new ethers.Contract(
    REGISTRIES.identity,
    ['function register(string agentURI) external returns (uint256 agentId)'],
    agent.connect(sep)
  );
  const card = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description: 'An agent that joined Assay by proving its own registration.',
    active: true,
    services: [],
  };
  console.log(`\nRegistering "${name}" on the ERC-8004 Identity Registry...`);
  const tx = await registry.register(`data:application/json,${encodeURIComponent(JSON.stringify(card))}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('registration reverted');

  const log = receipt.logs.find((l: ethers.Log) => l.topics[0] === IDENTITY_EVENTS.registered.topic0);
  if (!log) throw new Error('no Registered event');
  const parsed = new ethers.Interface([IDENTITY_EVENTS.registered.abi]).parseLog({
    topics: [...log.topics],
    data: log.data,
  });
  const agentId = Number(parsed!.args.agentId);

  console.log(`\nRegistered as agent ${agentId}`);
  console.log(`  ${SEPOLIA.explorerUrl}/tx/${receipt.hash}`);
  console.log(`\n  AGENT_ID=${agentId}`);
  console.log(`  REGISTRATION_TX=${receipt.hash}`);
  if (!own) {
    console.log(`  AGENT_PRIVATE_KEY=${agent.privateKey}`);
    console.log(`\nSave the key. This is the only copy.`);
  }
  console.log(`\nNext: apply, with the agent's own key.`);
  console.log(`  AGENT_PRIVATE_KEY=<key> pnpm apply ${receipt.hash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
