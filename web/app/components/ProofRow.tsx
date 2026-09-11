import type { ProvenFact } from '@/lib/evidence';
import { EvidenceExplainer } from './EvidenceExplainer';
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
      <header className="as-proofrow-head">
        <span className="as-proofrow-event">{fact.eventName}</span>
        <span className="as-proofrow-agent">agent #{fact.agentId}</span>
      </header>

      <p className="as-proofrow-detail">{fact.detail}</p>

      <p className="as-proofrow-emitter">
        <span className="as-label">emitted by</span>{' '}
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

      <footer className="as-proofrow-meta">
        <EvidenceExplainer fact={fact} />
        <span>
          block <span className="as-num">{fact.sourceBlock}</span>
        </span>
        {fact.attestationDelaySeconds !== null ? (
          <span className="as-proofrow-delay">
            attested <span className="as-num">{formatDelay(fact.attestationDelaySeconds)}</span>
          </span>
        ) : null}
      </footer>
    </article>
  );
}

function formatDelay(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `+${m}m${String(s).padStart(2, '0')}s`;
}
