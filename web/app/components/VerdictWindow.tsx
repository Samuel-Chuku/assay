import type { Agent } from '@/lib/agents';
import { Disclosure } from './Disclosure';
import { Reasoning } from './Reasoning';
import { Window } from './Window';

/**
 * The underwriter's judgment, verbatim.
 *
 * Never summarised, truncated, or prettified. The full reasoning is the
 * evidence that this is a reading of facts rather than a threshold on a score,
 * and shortening it would quietly remove the thing being demonstrated.
 *
 * The decision is deliberately not rendered in proof blue. A verdict is
 * *derived from* proven facts; it is not itself proven, and blurring that would
 * break the one law the colour carries.
 */
export function VerdictWindow({ agent, id = 'verdict', className }: { agent: Agent; id?: string; className?: string }) {
  const { verdict } = agent;

  if (!verdict) {
    return (
      <Window title={`Underwriter verdict · agent #${agent.agentId}`} id={id} className={className}>
        <p className="as-state">
          <strong>NO VERDICT YET</strong> — the underwriter needs at least one proven fact about this
          agent before it will form a judgment.
        </p>
      </Window>
    );
  }

  const declined = !verdict.approve;

  return (
    <Window title={`Underwriter verdict · agent #${agent.agentId}`} id={id} accent={declined ? 'frozen' : undefined} className={className}>
      <dl className="as-fields">
        <dt className="as-label">Decision</dt>
        <dd className={declined ? 'as-verdict-declined' : 'as-verdict-approved'}>
          {declined ? 'DECLINED' : 'APPROVED'}
        </dd>

        <dt className="as-label">Confidence</dt>
        <dd className="as-num">{verdict.confidence}</dd>

        <dt className="as-label">Evidence used</dt>
        <dd className="as-num">{verdict.evidence_used.length} proven facts</dd>

        <dt className="as-label">Decided by</dt>
        <dd>{verdict.source === 'envelope' ? 'policy envelope, before any model call' : verdict.model}</dd>
      </dl>

      <Reasoning text={verdict.reasoning} agentId={agent.agentId} />

      {verdict.adjustments.length > 0 ? (
        <div className="as-adjustments">
          <span className="as-label">Envelope tightened the judgment</span>
          <ul>
            {verdict.adjustments.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {agent.reasoningVerified === false ? (
        <p className="as-state as-state-alarm">
          <strong>REASONING DOES NOT MATCH ITS OWN HASH</strong> — the text shown here does not hash
          to the value recorded with this verdict. Treat it as unverified.
        </p>
      ) : null}

      {agent.boundToLine === true ? (
        <p className="as-caption">
          This is the judgment the credit line was opened on, and the reasoning above hashes to the
          value bound into that offer on Creditcoin. It is the text the contract was given, not a
          later rewrite.
        </p>
      ) : agent.boundToLine === false ? (
        /* Folded away so every agent card is the same height. The agents that
           carry this note are exactly the interesting ones, and their cards used
           to stand a head taller than the rest because of it. */
        <Disclosure summary="Re-judged since this line opened">
          Evidence moved, so the underwriter formed a new view. The reasoning above is that newer
          judgment and hashes to its own recorded value; the line itself is still bound to the
          earlier decision. Both are real, and the pair is the point: a verdict says what is true
          now, a line records what was true when it was offered.
        </Disclosure>
      ) : (
        <p className="as-caption">
          No credit line has been offered yet, so there is no on-chain offer to bind this judgment
          to. The reasoning above still hashes to the value recorded with it.
        </p>
      )}
    </Window>
  );
}
