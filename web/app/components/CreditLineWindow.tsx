import type { Agent } from '@/lib/agents';
import { LINE_STATES } from '@/lib/agents';
import { FreezeBanner } from './FreezeBanner';
import { LineActions } from './LineActions';
import { Meter } from './Meter';
import { Window } from './Window';

/**
 * The credit line, with its state machine rendered as a row so the current
 * position is readable at a glance.
 *
 * When a freeze trigger has fired, the reason goes in the window rather than a
 * tooltip, and the draw button is disabled with that reason stated.
 */
const VISIBLE_STATES = ['None', 'Offered', 'Active', 'Frozen', 'Repaid'] as const;

export function CreditLineWindow({ agent, id = 'line', className }: { agent: Agent; id?: string; className?: string }) {
  const { line } = agent;

  if (!line) {
    return (
      <Window title={`Credit line · agent #${agent.agentId}`} id={id} className={className}>
        <p className="as-state">
          <strong>NO CREDIT LINE</strong> — the underwriter needs at least one proven fact about this
          agent before it will form a judgment.
        </p>
      </Window>
    );
  }

  const frozen = line.state === 'Frozen' || line.pendingFreezeReason !== 'NotFrozen';
  const limit = Number(line.limit);
  const drawn = Number(line.principalOutstanding);
  const available = Math.max(0, limit - Number(line.totalDrawn));

  return (
    <Window
      title={`Credit line · agent #${agent.agentId}`}
      id={id}
      accent={frozen ? 'frozen' : undefined} className={className}
    >
      {frozen ? (
        <FreezeBanner
          reason={line.state === 'Frozen' ? line.freezeReason : line.pendingFreezeReason}
        />
      ) : null}

      <p className="as-statemachine">
        {VISIBLE_STATES.map((state, i) => (
          <span key={state}>
            {i > 0 ? <span className="as-statemachine-arrow"> → </span> : null}
            <span className={state === line.state ? 'as-state-current' : 'as-state-other'}>
              {state === line.state ? `[ ${state.toUpperCase()} ]` : state.toUpperCase()}
            </span>
          </span>
        ))}
      </p>

      <div className="as-amounts">
        <div>
          <span className="as-label">Drawn</span>
          <span className="as-amount as-num">{line.principalOutstanding}</span>
          <span className="as-label"> tCTC</span>
        </div>
        <div>
          <span className="as-label">Available</span>
          <span className="as-amount as-num">{available.toFixed(2)}</span>
          <span className="as-label"> tCTC</span>
        </div>
      </div>

      <Meter
        label="drawn"
        kind="drawn"
        fraction={limit === 0 ? 0 : drawn / limit}
        value={`${line.principalOutstanding} / ${line.limit}`}
      />

      <dl className="as-fields">
        <dt className="as-label">Limit</dt>
        <dd className="as-num">{line.limit} tCTC</dd>

        <dt className="as-label">Collateral posted</dt>
        <dd className="as-num">{line.collateralPosted} tCTC</dd>

        <dt className="as-label">Interest owed</dt>
        <dd className="as-num">{line.interestOwed} tCTC</dd>

        <dt className="as-label">Rate</dt>
        <dd className="as-num">{line.interestBps} bps</dd>

        <dt className="as-label">Expires</dt>
        <dd className="as-num">block {line.expiryBlock}</dd>
      </dl>

      <LineActions
        agentId={agent.agentId}
        borrower={line.borrower}
        state={line.state}
        frozenReason={frozen ? (line.state === 'Frozen' ? line.freezeReason : line.pendingFreezeReason) : null}
        owed={(Number(line.principalOutstanding) + Number(line.interestOwed)).toFixed(4)}
      />
    </Window>
  );
}

export { LINE_STATES };
