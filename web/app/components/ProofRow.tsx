import type { ProvenFact } from '@/lib/evidence';
import { TxLink, truncate } from './TxLink';

/**
 * One proven fact, in four lines. The signature element of the whole interface.
 *
 *   NewFeedback · agent #10156
 *   emitter 0x8004B6…8713  ✓ registry
 *   SEP 0x91cd4a…772f ↗  →  CC3 0x3f8b21…d0ae ↗
 *   block 11659062 · attested +9m24s
 *
 * Line 2 is the most important line on the screen. Event signatures are public,
 * so anyone can emit an identical event carrying invented values; what makes a
 * fact trustworthy is that the contract which emitted it matched a hardcoded
 * ERC-8004 address. The tag is always present, because a fact that failed that
 * check never got recorded — and that is exactly the point worth showing.
 *
 * The delay on line 4 is never softened. It is evidence the proof waited out
 * source-chain reversion risk rather than an apology for being slow.
 */
export function ProofRow({ fact }: { fact: ProvenFact }) {
  return (
    <article className="as-proofrow">
      <p className="as-proofrow-what">
        {fact.eventName} <span className="as-proofrow-sep">·</span> agent #{fact.agentId}
        <span className="as-proofrow-detail"> {fact.detail}</span>
      </p>

      <p className="as-proofrow-emitter">
        <span className="as-label">emitter</span>{' '}
        <span className="as-proven as-num" title={`${fact.emitterName} · ${fact.emitter}`}>
          {truncate(fact.emitter)}
        </span>{' '}
        <span className="as-registry-tag">✓ registry</span>
      </p>

      <p className="as-proofrow-links">
        <TxLink chain="SEP" hash={fact.sourceTxHash} />
        <span className="as-proofrow-arrow" aria-hidden="true">
          →
        </span>
        <TxLink chain="CC3" hash={fact.verificationTxHash} />
      </p>

      <p className="as-proofrow-meta">
        block {fact.sourceBlock}
        {fact.attestationDelaySeconds !== null ? (
          <>
            {' '}
            <span className="as-proofrow-sep">·</span> attested{' '}
            {formatDelay(fact.attestationDelaySeconds)}
          </>
        ) : null}
      </p>
    </article>
  );
}

function formatDelay(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `+${m}m${String(s).padStart(2, '0')}s`;
}
