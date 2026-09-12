import { NextResponse } from 'next/server';

import { getRecentActivity } from '@/lib/activity';

/**
 * Recent credit-line activity, for the live feed on the home page.
 *
 * Dynamic, so a poll sees what the chain has now rather than what the page
 * had at build time. The underlying log read is memoised for 45s in
 * lib/activity, so however many tabs poll, the chain is asked once a window.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activity = await getRecentActivity(8);
    return NextResponse.json(
      { activity, at: Date.now() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : String(cause) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
