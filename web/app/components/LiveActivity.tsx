'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { Activity } from '@/lib/activity';
import { CREDITCOIN } from '@assay/config/chains';
import { Icon, type IconName } from './Icon';
import { ScrollBox } from './ScrollBox';

type Row = Activity & { agentId: number };

const ICONS: Record<Activity['kind'], IconName> = {
  offered: 'judge',
  accepted: 'credit',
  drawn: 'draw',
  repaid: 'repay',
  frozen: 'freeze',
  closed: 'check',
};

function ago(ts: number | null, now: number): string {
  if (ts === null) return '';
  const s = Math.max(0, Math.floor(now / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * What is happening on the credit contract, right now, refreshed on its own.
 *
 * The site reads real state, but a page that never changes while you look at
 * it cannot prove it. This polls, and a new row slides in with a timestamp in
 * seconds, which is the only argument that actually lands: the borrower is a
 * process that runs whether or not anyone is watching.
 */
export function LiveActivity({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [seen, setSeen] = useState<Set<string>>(() => new Set(initial.map((r) => r.txHash + r.kind)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      try {
        const res = await fetch('/api/activity');
        if (!res.ok) return;
        const data = (await res.json()) as { activity: Row[] };
        if (cancelled) return;
        const incoming = new Set<string>();
        for (const r of data.activity) {
          const k = r.txHash + r.kind;
          if (!seen.has(k)) incoming.add(k);
        }
        setRows(data.activity);
        if (incoming.size > 0) {
          setFresh(incoming);
          setSeen((prev) => new Set([...prev, ...incoming]));
          setTimeout(() => setFresh(new Set()), 4000);
        }
      } catch {
        // Keep what we have. A failed poll is not a reason to blank the feed.
      }
    };

    const poll = setInterval(read, 30_000);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [seen]);

  if (rows.length === 0) {
    return (
      <p className="as-state">
        <strong>NOTHING YET</strong> — no line has been offered, so there is nothing to have
        happened.
      </p>
    );
  }

  return (
    <ScrollBox maxHeight={400}>
    <ol className="as-live-feed">
      {rows.map((r) => {
        const k = r.txHash + r.kind;
        return (
          <li key={k} className={`as-live-row is-${r.kind}${fresh.has(k) ? ' is-fresh' : ''}`}>
            <span className={`as-sim-chip as-live-chip is-${r.kind}`}>
              <Icon name={ICONS[r.kind]} size={20} />
            </span>
            <span className="as-live-body">
              <span className="as-live-label">
                <Link href={`/app/${r.agentId}`}>#{r.agentId}</Link> · {r.label}
              </span>
              <span className="as-live-meta">
                <span className={`as-activity-actor is-${r.actor}`}>
                  {r.actor === 'agent' ? 'by the agent' : r.actor === 'underwriter' ? 'by the underwriter' : 'by anyone'}
                </span>
                <a href={`${CREDITCOIN.explorerUrl}/tx/${r.txHash}`} target="_blank" rel="noreferrer">
                  {r.txHash.slice(0, 10)}…&nbsp;↗
                </a>
                <span className="as-live-when">{ago(r.timestamp, now)}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
    </ScrollBox>
  );
}
