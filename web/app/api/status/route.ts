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

export async function GET() {
  try {
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

    return NextResponse.json({
      creditcoinHeight,
      sepoliaAttestedHeight,
      gapBlocks: Math.max(0, sepoliaHead - sepoliaAttestedHeight),
    });
  } catch (cause) {
    // The menu bar keeps its loading state rather than showing a wrong number.
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : String(cause) },
      { status: 503 }
    );
  }
}
