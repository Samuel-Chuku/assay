'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Modal } from './Modal';

export type OutcomeRow = {
  agentId: number;
  approved: boolean;
  verdictLabel: string;
  lineLabel: string;
  why: string;
};

/**
 * The landing page's outcomes, bounded.
 *
 * Any agent can join by proving its own registration, so this list grows on
 * its own. The window shows the first few; the rest open in a modal rather
 * than stretching the window down the page.
 */
const VISIBLE = 5;

export function OutcomeList({ rows }: { rows: OutcomeRow[] }) {
  const [open, setOpen] = useState(false);
  const shown = rows.slice(0, VISIBLE);
  const hidden = rows.length - shown.length;

  return (
    <>
      <Rows rows={shown} />
      {hidden > 0 ? (
        <p className="as-agent-more">
          <button type="button" className="as-reasoning-toggle" onClick={() => setOpen(true)}>
            Show {hidden} more
          </button>
        </p>
      ) : null}
      <Modal open={open} onClose={() => setOpen(false)} title={`All ${rows.length} agents`}>
        <Rows rows={rows} />
      </Modal>
    </>
  );
}

function Rows({ rows }: { rows: OutcomeRow[] }) {
  return (
    <ul className="as-outcome-list">
      {rows.map((a) => (
        <li key={a.agentId}>
          <Link className="as-outcome" href={`/app/${a.agentId}`}>
            <span className="as-outcome-id">#{a.agentId}</span>
            <span className={a.approved ? 'as-outcome-verdict is-yes' : 'as-outcome-verdict is-no'}>
              {a.verdictLabel}
            </span>
            <span className="as-outcome-line">{a.lineLabel}</span>
            <span className="as-outcome-why">{a.why}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
