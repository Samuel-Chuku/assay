import type { Agent } from '@/lib/agents';
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

      <div className="as-reasoning">{verdict.reasoning}</div>

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

      <p className="as-caption">
        {agent.reasoningVerified === true ? (
          <>
            The reasoning above hashes to the value bound into this agent&rsquo;s offer on Creditcoin,
            so it is the text the contract was given, not a later rewrite.
          </>
        ) : agent.reasoningVerified === false ? (
          <>
            <strong>REASONING DOES NOT MATCH THE CHAIN</strong> — the text shown here does not hash to
            the value bound into the on-chain offer. Treat it as unverified.
          </>
        ) : (
          <>No credit line has been offered yet, so there is no on-chain hash to check this against.</>
        )}
      </p>
    </Window>
  );
}
