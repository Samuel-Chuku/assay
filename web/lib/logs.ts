import 'server-only';

import { ethers } from 'ethers';

import { ORACLE_DEPLOYED_AT_BLOCK } from '@assay/config/deployments';

/**
 * A whole-history log read, in windows small enough to return.
 *
 * Creditcoin abandons any `eth_getLogs` taking more than ten seconds. Reading
 * the full history from the oracle's deployment measured 9.62s across 20,166
 * blocks, and that window grows by 5,760 blocks every day. So this was not a
 * query that sometimes failed; it was one already failing intermittently and
 * days away from failing permanently.
 *
 * Windows are requested together rather than in sequence. Four short queries in
 * parallel are faster than one long one, and each stays well inside the limit.
 */
const WINDOW = 5_000;

export async function fullHistoryLogs(
  cc: ethers.JsonRpcProvider,
  filter: { address: string; topics?: (string | string[] | null)[] }
): Promise<ethers.Log[]> {
  const head = await cc.getBlockNumber();

  const ranges: { from: number; to: number }[] = [];
  for (let start = ORACLE_DEPLOYED_AT_BLOCK; start <= head; start += WINDOW) {
    ranges.push({ from: start, to: Math.min(start + WINDOW - 1, head) });
  }

  const batches = await Promise.all(
    ranges.map((r) => cc.getLogs({ ...filter, fromBlock: r.from, toBlock: r.to }))
  );

  // Back into chain order: the windows come back in whatever order they finish.
  return batches
    .flat()
    .sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
}
