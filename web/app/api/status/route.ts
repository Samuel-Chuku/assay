import { NextResponse } from 'next/server';
import { chainInfo } from '@gluwa/usc-sdk';

import { SEPOLIA } from '@assay/config/chains';
import { creditcoin, sepolia } from '@/lib/chain';

/**
 * Chain heights for the menu bar.
 *
 * The Creditcoin head beside the latest Sepolia height the attestor network has
 * attested for chain key 1. That pair is proof the system is running against
 * two chains while someone reads about it, which no paragraph of copy can do.
 *
 * Server-side so the RPC endpoints never reach the browser.
 */
export const dynamic = 'force-dynamic';

type Status = {
  creditcoinHeight: number;
  sepoliaAttestedHeight: number;
  gapBlocks: number;
};

/**
 * One upstream read per window, however many people are watching.
 *
 * Every open tab polls this every 15 seconds, and each poll used to cost three
 * upstream calls across two chains. Ten tabs left open was thirty calls every
 * fifteen seconds for an answer that is identical for all of them. The heights
 * are global state, not per-viewer, so they are read once and shared.
 *
 * The window matches Creditcoin's 15s block time: a cached answer is at most one
 * block behind, which is the resolution the indicator has anyway.
 */
const WINDOW_MS = 15_000;

let cached: { at: number; status: Status } | null = null;
let inFlight: Promise<Status> | null = null;

async function read(): Promise<Status> {
  const cc = creditcoin();
  const sep = sepolia();

  const [creditcoinHeight, sepoliaHead, attested] = await Promise.all([
    cc.getBlockNumber(),
    sep.getBlockNumber(),
    new chainInfo.PrecompileChainInfoProvider(cc).getLatestAttestedHeightAndHash(
      SEPOLIA.sourceChainKey
    ),
  ]);

  const sepoliaAttestedHeight = Number(attested.height);

  return {
    creditcoinHeight,
    sepoliaAttestedHeight,
    gapBlocks: Math.max(0, sepoliaHead - sepoliaAttestedHeight),
  };
}

/**
 * Concurrent callers share one read rather than starting their own. Without
 * this, ten tabs polling in the same instant all miss the cache together and
 * the collapse never happens.
 */
function current(): Promise<Status> {
  if (cached && Date.now() - cached.at < WINDOW_MS) {
    return Promise.resolve(cached.status);
  }
  if (!inFlight) {
    inFlight = read()
      .then((status) => {
        cached = { at: Date.now(), status };
        return status;
      })
      .finally(() => {
        // A failure is not cached: the next caller retries rather than being
        // served a stale error for the rest of the window.
        inFlight = null;
      });
  }
  return inFlight;
}

export async function GET() {
  try {
    return NextResponse.json(await current(), {
      // The browser still asks every 15s; what it gets back is cheap. Caching
      // the response too would let a tab drift further behind the chain than
      // the window above allows.
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (cause) {
    // The menu bar keeps its loading state rather than showing a wrong number.
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : String(cause) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
