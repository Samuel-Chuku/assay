import 'server-only';

import { ethers } from 'ethers';

import { CREDIT_LINE_ABI } from '@assay/config/abi';
import { DEPLOYMENTS, ORACLE_DEPLOYED_AT_BLOCK } from '@assay/config/deployments';
import { creditcoin, retry } from './chain';
import { fullHistoryLogs } from './logs';

/**
 * What an agent has actually done with its credit line.
 *
 * The borrowing half of Assay runs as a process holding the agent's own key,
 * which cannot live in a browser and should not: the site holds no keys and an
 * agent does not use one. What the site can do is show the footprint, because
 * every decision the agent makes lands on chain as an event.
 *
 * So this is not a report the borrower sends us. It is read back out of
 * `CreditLine`, which means it cannot flatter the agent and does not depend on
 * the borrower still being online.
 */
export type ActivityKind = 'offered' | 'accepted' | 'drawn' | 'repaid' | 'frozen' | 'closed';

export type Activity = {
  kind: ActivityKind;
  /** Past-tense, from the agent's point of view where it acted. */
  label: string;
  detail: string;
  /** Who took the action: the agent itself, or the underwriter. */
  actor: 'agent' | 'underwriter' | 'anyone';
  txHash: string;
  block: number;
  timestamp: number | null;
};

const FREEZE_REASONS = ['NotFrozen', 'IdentityTransferred', 'WalletChanged', 'EvidenceStale'];

const ctc = (v: bigint): string => `${Number(ethers.formatEther(v)).toFixed(3)} tCTC`;

/**
 * The credit contract's whole log history, memoised.
 *
 * Same reasoning as the oracle's: one scan across every block since deployment,
 * shared by every agent page rather than paid for once per agent.
 */
const WINDOW_MS = 45_000;
let cache: { at: number; logs: ethers.Log[] } | null = null;
let inFlight: Promise<ethers.Log[]> | null = null;

async function creditLogs(cc: ethers.JsonRpcProvider): Promise<ethers.Log[]> {
  if (cache && Date.now() - cache.at < WINDOW_MS) return cache.logs;

  if (!inFlight) {
    inFlight = retry('reading credit line activity', 3, () =>
      fullHistoryLogs(cc, { address: DEPLOYMENTS.creditLine })
    )
      .then((logs) => {
        cache = { at: Date.now(), logs };
        return logs;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Block timestamps never change, so they are kept for the life of the process. */
const blockTimes = new Map<number, Promise<number | null>>();

/**
 * Recent activity across every agent, newest first.
 *
 * The per-agent feed answers "what did this one do". This answers "is anything
 * happening", which is the question a first-time visitor is actually asking,
 * and the honest answer is only convincing if the timestamps are minutes old.
 */
export async function getRecentActivity(limit = 10): Promise<(Activity & { agentId: number })[]> {
  const cc = creditcoin();
  const iface = new ethers.Interface(CREDIT_LINE_ABI as unknown as string[]);
  const logs = await creditLogs(cc);

  const all: (Activity & { agentId: number })[] = [];
  for (const log of logs) {
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.args.agentId === undefined) continue;
    const a = describe(parsed, log);
    if (a) all.push({ ...a, agentId: Number(parsed.args.agentId) });
  }

  const recent = all.slice(-limit).reverse();
  await stamp(cc, recent);
  return recent;
}

export async function getActivity(agentId: number, limit = 12): Promise<Activity[]> {
  const cc = creditcoin();
  const iface = new ethers.Interface(CREDIT_LINE_ABI as unknown as string[]);
  const logs = await creditLogs(cc);

  const mine: Activity[] = [];

  for (const log of logs) {
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.args.agentId === undefined) continue;
    if (Number(parsed.args.agentId) !== agentId) continue;
    const a = describe(parsed, log);
    if (a) mine.push(a);
  }

  const recent = mine.slice(-limit).reverse();
  await stamp(cc, recent);
  return recent;
}

/** One credit-line event, in words. */
function describe(parsed: ethers.LogDescription, log: ethers.Log): Activity | null {
  const base = { txHash: log.transactionHash, block: log.blockNumber, timestamp: null };

  switch (parsed.name) {
    case 'LineOffered':
      return {
        ...base,
        kind: 'offered',
        actor: 'underwriter',
        label: 'Line offered',
        detail: `${ctc(parsed.args.limit)} limit at ${parsed.args.interestBps} bps, against ${ctc(parsed.args.collateralRequired)} of collateral`,
      };
    case 'LineAccepted':
      return {
        ...base,
        kind: 'accepted',
        actor: 'agent',
        label: 'Agent accepted the terms',
        detail: `posted ${ctc(parsed.args.collateralPosted)} of collateral`,
      };
    case 'Drawn':
      return {
        ...base,
        kind: 'drawn',
        actor: 'agent',
        label: `Agent drew ${ctc(parsed.args.amount)}`,
        detail: `${ctc(parsed.args.principalOutstanding)} outstanding after this`,
      };
    case 'RepaidLine':
      return {
        ...base,
        kind: 'repaid',
        actor: 'agent',
        label: `Agent repaid ${ctc(parsed.args.principal)}`,
        detail: `plus ${ctc(parsed.args.interest)} of interest; ${ctc(parsed.args.principalOutstanding)} still outstanding`,
      };
    case 'LineFrozen':
      return {
        ...base,
        kind: 'frozen',
        actor: 'anyone',
        label: 'Line frozen',
        detail: `${FREEZE_REASONS[Number(parsed.args.reason)]} — anyone may call this, it needs no permission`,
      };
    case 'LineClosed':
      return {
        ...base,
        kind: 'closed',
        actor: 'agent',
        label: 'Line closed',
        detail: `${ctc(parsed.args.collateralReturned)} of collateral returned`,
      };
    default:
      return null;
  }
}

/** Fills in block timestamps, from a cache that never expires. */
async function stamp(cc: ethers.JsonRpcProvider, items: Activity[]): Promise<void> {
  await Promise.all(
    items.map(async (a) => {
      if (!blockTimes.has(a.block)) {
        blockTimes.set(
          a.block,
          cc
            .getBlock(a.block)
            .then((b) => b?.timestamp ?? null)
            .catch(() => null)
        );
      }
      a.timestamp = await blockTimes.get(a.block)!;
    })
  );
}
