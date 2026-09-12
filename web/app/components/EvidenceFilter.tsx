'use client';

import { useMemo, useState } from 'react';

import type { FactKind, ProvenFact } from '@/lib/evidence';
import { ProofRow } from './ProofRow';
import { ScrollBox } from './ScrollBox';

/**
 * The evidence list, filterable by what kind of fact each row is.
 *
 * Four kinds exist and they mean very different things: a registration says an
 * identity exists, feedback says a client rated it, a transfer says it changed
 * hands, a wallet change says its revenue moved. A reader looking for the one
 * transfer among twenty feedback rows should not have to scan for it.
 *
 * Only kinds that are actually present get a chip, with a count, so the filter
 * never offers an empty result.
 */
const LABELS: Record<FactKind, string> = {
  identity: 'Registered',
  feedback: 'Feedback',
  transfer: 'Transferred',
  wallet: 'Wallet changed',
};

const ORDER: FactKind[] = ['identity', 'feedback', 'transfer', 'wallet'];

export function EvidenceFilter({ facts, maxHeight = 560 }: { facts: ProvenFact[]; maxHeight?: number }) {
  const [kind, setKind] = useState<FactKind | 'all'>('all');

  const counts = useMemo(() => {
    const c = new Map<FactKind, number>();
    for (const f of facts) c.set(f.kind, (c.get(f.kind) ?? 0) + 1);
    return c;
  }, [facts]);

  const shown = kind === 'all' ? facts : facts.filter((f) => f.kind === kind);
  const present = ORDER.filter((k) => counts.has(k));

  return (
    <>
      {present.length > 1 ? (
        <div className="as-filter" role="group" aria-label="Filter evidence by kind">
          <button
            type="button"
            className={`as-filter-chip${kind === 'all' ? ' is-on' : ''}`}
            onClick={() => setKind('all')}
            aria-pressed={kind === 'all'}
          >
            All <span className="as-filter-count">{facts.length}</span>
          </button>
          {present.map((k) => (
            <button
              key={k}
              type="button"
              className={`as-filter-chip is-${k}${kind === k ? ' is-on' : ''}`}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
            >
              {LABELS[k]} <span className="as-filter-count">{counts.get(k)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <ScrollBox maxHeight={maxHeight}>
        {shown.map((fact) => (
          <ProofRow key={`${fact.verificationTxHash}-${fact.queryId}`} fact={fact} />
        ))}
      </ScrollBox>
    </>
  );
}
