'use client';

import { useState } from 'react';

import { Modal } from './Modal';

/**
 * The underwriter's reasoning, which is long on purpose.
 *
 * It is never summarised or rewritten: the full argument is the evidence that
 * this is a reading of facts rather than a threshold on a score. But at full
 * length it made one card three times the height of its neighbours, so it is
 * clamped by default with two ways out.
 *
 * Expanding in place keeps you where you were on the page. The modal is for
 * actually reading it, at a comfortable measure, with the page held still
 * behind. Both show the same text; neither shortens it.
 */
const CLAMP_LINES = 6;

export function Reasoning({ text, agentId }: { text: string; agentId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(false);

  // Roughly the clamp height in characters. Below this there is nothing to
  // expand and the controls would be noise.
  const long = text.length > 420;

  return (
    <>
      <div className={`as-reasoning${long && !expanded ? ' is-clamped' : ''}`}>{text}</div>

      {long ? (
        <p className="as-reasoning-actions">
          <button
            type="button"
            className="as-reasoning-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="as-disclosure-caret" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            {expanded ? 'Show less' : 'Read the full reasoning'}
          </button>
          <button type="button" className="as-reasoning-toggle" onClick={() => setModal(true)}>
            Open in a window ↗
          </button>
        </p>
      ) : null}

      <Modal open={modal} onClose={() => setModal(false)} title={`Verdict · agent #${agentId}`}>
        <p className="as-modal-lede">
          The underwriter&rsquo;s reasoning in full, exactly as it was written and hashed. Nothing
          here is summarised.
        </p>
        <div className="as-reasoning as-reasoning-full">{text}</div>
      </Modal>
    </>
  );
}
