import type { ProvenFact } from '@/lib/evidence';
import { ProofRow } from './ProofRow';
import { Window } from './Window';

/**
 * The centrepiece. Real proven facts with working explorer links, the same
 * component on the landing page and in the app.
 *
 * The caption below the rows is the strongest paragraph on the site: it names
 * the attack the emitter check exists to prevent. It is not decoration and it
 * does not get shortened into something vaguer.
 */
export function EvidenceWindow({
  facts,
  error,
  id = 'evidence',
  className,
}: {
  facts: ProvenFact[];
  error?: string;
  id?: string;
  className?: string;
}) {
  return (
    <Window title="Live evidence" id={id} className={className}>
      <p className="as-evidence-intro">
        Every fact below was emitted by an ERC-8004 registry on Ethereum, attested by the Attestcoin
        network, and verified on Creditcoin by the precompile at <code>0x0FD2</code>. Both
        transactions are linked. Nothing here was reported by an operator.
      </p>

      {error ? (
        <p className="as-state">
          <strong>EVIDENCE UNAVAILABLE</strong> — {error}
        </p>
      ) : facts.length === 0 ? (
        <p className="as-state">
          <strong>NO EVIDENCE YET</strong> — facts appear here once an ERC-8004 event has been
          attested on Sepolia and verified on Creditcoin. This takes about ten minutes by design, to
          survive source-chain reorganisation.
        </p>
      ) : (
        <div className="as-evidence-rows">
          {facts.map((fact) => (
            <ProofRow key={`${fact.verificationTxHash}-${fact.queryId}`} fact={fact} />
          ))}
        </div>
      )}

      <p className="as-caption">
        The <span className="as-registry-tag">✓ registry</span> tag means the emitting contract
        matched one of two hardcoded addresses. Event signatures are public, so anyone can emit an
        identical event with invented values. Trust comes from who emitted it, never from what it
        says.
      </p>
    </Window>
  );
}
