/**
 * An agent that manages its own credit line.
 *
 * Everything else in this repository is Assay's half: proving facts, judging
 * them, offering terms. This is the other half, and it is deliberately not
 * operated by us. It holds the agent's key, reads the agent's own line, and
 * decides for itself when to borrow and when to repay.
 *
 * That separation is the whole point. The contract gates the borrower path on
 * `msg.sender == line.borrower` and nothing else, so any agent holding its own
 * key can do this without asking us. This file is a demonstration of that, not
 * a privileged path.
 *
 * What it does on each tick:
 *
 *   - reads its line and its own balance
 *   - accepts an offer when it can afford the collateral
 *   - draws when it cannot pay for its next job and the line has headroom
 *   - works: pays a supplier for inference, and gets paid by a client
 *   - repays when it is holding more than it needs, because idle borrowed
 *     capital costs interest
 *
 * It never assumes a draw will succeed. Assay re-checks every freeze trigger
 * inside `draw`, so the honest thing is to attempt it and read the refusal.
 *
 *   pnpm borrow <agentId>            run until stopped
 *   pnpm borrow <agentId> --once     one decision, for a smoke test
 *   pnpm borrow <agentId> --dry      decide and explain, sign nothing
 */
import 'dotenv/config';

import { ethers } from 'ethers';

import { CREDIT_LINE_ABI } from '../config/abi';
import { BORROWER } from '../config/borrower';
import { CREDITCOIN, GAS_LIMIT_MULTIPLIER } from '../config/chains';
import { DEPLOYMENTS } from '../config/deployments';
import { DEMO_WALLET_COUNT } from '../config/demo';

const STATES = ['None', 'Offered', 'Active', 'Frozen', 'Repaid', 'Defaulted'] as const;
const FREEZE = ['NotFrozen', 'IdentityTransferred', 'WalletChanged', 'EvidenceStale'] as const;

const log = (message: string): void =>
  console.log(`${new Date().toISOString().slice(11, 19)}  ${message}`);

const ctc = (v: bigint): string => `${Number(ethers.formatEther(v)).toFixed(3)} tCTC`;

/**
 * The agent's own key.
 *
 * A real agent sets `BORROWER_PRIVATE_KEY` and this file never knows where it
 * came from. The demo cast is derived from the deployer for convenience only,
 * and is the one part of this that a real borrower would not have.
 */
function borrowerKey(expectedAddress: string): ethers.Wallet {
  const own = process.env.BORROWER_PRIVATE_KEY?.trim();
  if (own) return new ethers.Wallet(own.startsWith('0x') ? own : `0x${own}`);

  const deployer = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!deployer) {
    throw new Error('Set BORROWER_PRIVATE_KEY to the agent’s own key, or DEPLOYER_PRIVATE_KEY to use the demo cast.');
  }
  const root = deployer.startsWith('0x') ? deployer : `0x${deployer}`;

  for (let i = 0; i <= DEMO_WALLET_COUNT; i++) {
    const candidate =
      i === 0
        ? new ethers.Wallet(root)
        : new ethers.Wallet(
            ethers.solidityPackedKeccak256(
              ['bytes32', 'string', 'uint256'],
              [root, 'assay-demo-cast', i]
            )
          );
    if (candidate.address.toLowerCase() === expectedAddress.toLowerCase()) return candidate;
  }
  throw new Error(`No key for borrower ${expectedAddress}. Set BORROWER_PRIVATE_KEY.`);
}

type Decision =
  | { do: 'accept'; collateral: bigint; why: string }
  | { do: 'draw'; amount: bigint; why: string }
  | { do: 'repay'; amount: bigint; why: string }
  | { do: 'work'; why: string }
  | { do: 'wait'; why: string };

/** The agent's own policy. Assay has no say in any of this. */
function decide(
  state: (typeof STATES)[number],
  balance: bigint,
  line: { limit: bigint; collateralRequired: bigint; principalOutstanding: bigint; interestOwed: bigint },
  drawsMade: number
): Decision {
  const low = ethers.parseEther(String(BORROWER.lowWaterMark));
  const high = ethers.parseEther(String(BORROWER.highWaterMark));
  const jobCost = ethers.parseEther(String(BORROWER.jobCost));
  const headroom = line.limit - line.principalOutstanding;

  if (state === 'Offered') {
    if (balance < line.collateralRequired) {
      return { do: 'wait', why: `offer needs ${ctc(line.collateralRequired)} of collateral and I hold ${ctc(balance)}` };
    }
    return { do: 'accept', collateral: line.collateralRequired, why: 'the terms are affordable, so take the line' };
  }

  if (state !== 'Active' && state !== 'Frozen') {
    return { do: 'wait', why: `line is ${state}; nothing for me to do` };
  }

  const owed = line.principalOutstanding + line.interestOwed;

  // Repay before drawing: holding borrowed capital I am not using costs
  // interest, and a smaller balance makes the next draw decision honest.
  if (owed > 0n && balance > high) {
    const spare = balance - high;
    const amount = spare > owed ? owed : spare;
    return { do: 'repay', amount, why: `holding ${ctc(balance)}, more than I need; paying down ${ctc(amount)} of ${ctc(owed)}` };
  }

  if (balance < low && headroom > 0n) {
    if (drawsMade >= BORROWER.maxDrawsPerRun) {
      return { do: 'wait', why: `already drew ${drawsMade} times this run; holding at my own ceiling` };
    }
    const want = high - balance;
    const min = ethers.parseEther(String(BORROWER.minDraw));
    let amount = want < min ? min : want;
    if (amount > headroom) amount = headroom;
    return { do: 'draw', amount, why: `down to ${ctc(balance)}, below my ${BORROWER.lowWaterMark} floor, with ${ctc(headroom)} still available` };
  }

  if (balance >= jobCost) return { do: 'work', why: `${ctc(balance)} on hand, enough for the next job` };

  return { do: 'wait', why: `${ctc(balance)} on hand and no headroom left; I cannot work or borrow` };
}

async function send(
  label: string,
  run: () => Promise<ethers.TransactionResponse>
): Promise<boolean> {
  try {
    const tx = await run();
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      log(`  ${label} reverted`);
      return false;
    }
    log(`  ${label} ${receipt.hash}`);
    return true;
  } catch (error) {
    const message = (error as Error).message;
    // A refusal is information, not a crash: Assay re-checks the freeze
    // triggers inside draw, so this is how an agent learns the world moved.
    log(`  ${label} refused: ${message.slice(0, 140)}`);
    return false;
  }
}

async function main(): Promise<void> {
  const agentId = Number(process.argv[2]);
  if (!Number.isInteger(agentId)) throw new Error('usage: pnpm borrow <agentId> [--once] [--dry]');
  const once = process.argv.includes('--once');
  const dry = process.argv.includes('--dry');

  const cc = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
  const reader = new ethers.Contract(DEPLOYMENTS.creditLine, CREDIT_LINE_ABI, cc);

  const snapshot = await reader.getLine(agentId);
  if (Number(snapshot.state) === 0) throw new Error(`agent ${agentId} has no credit line`);

  const wallet = borrowerKey(snapshot.borrower).connect(cc);
  const credit = reader.connect(wallet) as ethers.Contract;
  const buffer = BigInt(Math.round(GAS_LIMIT_MULTIPLIER * 100));

  log(`agent ${agentId} borrowing as ${wallet.address}`);
  log(`policy: draw below ${BORROWER.lowWaterMark}, repay above ${BORROWER.highWaterMark} tCTC${dry ? '  [dry run]' : ''}`);

  let draws = 0;
  let earned = 0n;

  for (;;) {
    const line = await reader.getLine(agentId);
    const state = STATES[Number(line.state)];
    const balance = await cc.getBalance(wallet.address);
    const pending = FREEZE[Number(await reader.pendingFreezeReason(agentId))];

    const decision = decide(state, balance, line, draws);
    log(`${state}  balance ${ctc(balance)}  owed ${ctc(line.principalOutstanding + line.interestOwed)}${pending === 'NotFrozen' ? '' : `  [${pending}]`}`);
    log(`  → ${decision.do}: ${decision.why}`);

    if (!dry) {
      if (decision.do === 'accept') {
        const gas = await credit.accept.estimateGas(agentId, { value: decision.collateral });
        await send('accepted', () =>
          credit.accept(agentId, { value: decision.collateral, gasLimit: (gas * buffer) / 100n })
        );
      } else if (decision.do === 'draw') {
        const ok = await send('drew ' + ctc(decision.amount), async () => {
          const gas = await credit.draw.estimateGas(agentId, decision.amount);
          return credit.draw(agentId, decision.amount, { gasLimit: (gas * buffer) / 100n });
        });
        if (ok) draws++;
        else log('  the line would not release funds; I will keep working on what I have');
      } else if (decision.do === 'repay') {
        const gas = await credit.repay.estimateGas(agentId, { value: decision.amount });
        await send('repaid ' + ctc(decision.amount), () =>
          credit.repay(agentId, { value: decision.amount, gasLimit: (gas * buffer) / 100n })
        );
      } else if (decision.do === 'work') {
        // Work costs money before it earns any: the exact problem Assay exists
        // for. Paying a supplier and being paid by a client are both real
        // transfers, so the balance moves for real reasons.
        const cost = ethers.parseEther(String(BORROWER.jobCost));
        const revenue = ethers.parseEther(String(BORROWER.jobRevenue));
        const supplier = ethers.Wallet.createRandom().address;
        await send(`paid ${ctc(cost)} for inference`, () =>
          wallet.sendTransaction({ to: supplier, value: cost })
        );
        earned += revenue;
        log(`  job done; ${ctc(revenue)} invoiced, ${ctc(earned)} earned this run`);
      }
    }

    if (once) return;
    await new Promise((r) => setTimeout(r, BORROWER.tickSeconds * 1000));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
