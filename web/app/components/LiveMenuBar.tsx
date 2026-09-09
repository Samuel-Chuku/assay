'use client';

import { useEffect, useState } from 'react';

import { MenuBar, type ChainStatus } from './MenuBar';

/**
 * Polls the chain heights every 15 seconds.
 *
 * On failure it keeps the previous reading rather than blanking, and starts in
 * the loading state rather than at zero — a rendered number is a claim about a
 * chain, and we only make it once we have read one.
 */
export function LiveMenuBar() {
  const [status, setStatus] = useState<ChainStatus | null>(null);

  useEffect(() => {
    let live = true;

    async function read() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = (await res.json()) as ChainStatus;
        if (live) setStatus(data);
      } catch {
        // Keep the last good reading.
      }
    }

    void read();
    const timer = setInterval(read, 15_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  return <MenuBar status={status} />;
}
