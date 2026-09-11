'use client';

import { useState } from 'react';

import { UNDERWRITING_ENVELOPE as E } from '@assay/config/underwriting';
import {
  FREEZE_EXPLAIN,
  PROFILES,
  envelope,
  judge,
  pendingFreeze,
  type ActionId,
  type Outcome,
  type SimState,
} from '@/lib/simulate';
import { Icon, type IconName } from './Icon';
import { Window } from './Window';

/**
 * "If you do this, this happens", against the real rules.
 *
 * Every branch here is the branch the deployed system takes. The value is not
 * that it looks interactive; it is that someone can try the attack the contract
 * was written to stop and watch it stop, in ten seconds, without a wallet or a
 * testnet faucet.
 */

type Step = { outcome: Outcome; state: SimState };

const ACTIONS: {
  id: ActionId;
  label: string;
  icon: IconName;
  promise: string;
  show: (s: SimState) => boolean;
  disabled?: (s: SimState) => string | null;
}[] = [
  {
    id: 'apply',
    label: 'Apply for credit',
    icon: 'judge',
    promise: 'Runs the policy envelope, then the underwriter, and returns a verdict.',
    show: (s) => s.line === 'None',
  },
  {
    id: 'accept',
    label: 'Post collateral',
    icon: 'credit',
    promise: 'Accepts the offer and activates the line.',
    show: (s) => s.line === 'Offered',
  },
  {
    id: 'draw',
    label: 'Draw funds',
    icon: 'draw',
    promise: 'Re-checks every freeze trigger, then releases funds from the pool.',
    show: (s) => s.line === 'Active' || s.line === 'Frozen',
    disabled: (s) => (s.drawn >= s.limit ? 'The line is fully drawn.' : null),
  },
  {
    id: 'repay',
    label: 'Repay',
    icon: 'repay',
    promise: 'Returns principal and interest, and releases the collateral.',
    show: (s) => s.drawn > 0 && (s.line === 'Active' || s.line === 'Frozen'),
  },
  {
    id: 'sell',
    label: 'Sell the identity',
    icon: 'identity',
    promise: 'Transfers the ERC-8004 token to someone else. This is the attack.',
    show: (s) => s.line !== 'Repaid',
  },
  {
    id: 'changeWallet',
    label: 'Change payment wallet',
    icon: 'wallet',
    promise: 'Calls setAgentWallet, pointing revenue at a new address.',
    show: (s) => s.line !== 'Repaid',
  },
  {
    id: 'age',
    label: 'Wait four days',
    icon: 'clock',
    promise: 'Nothing new gets proven, so the evidence goes stale.',
    show: (s) => s.line !== 'Repaid',
  },
  {
    id: 'proveFresh',
    label: 'Prove new work',
    icon: 'chain',
    promise: 'A new client rates the agent on Ethereum; the watcher proves it.',
    show: (s) => s.line !== 'Repaid',
  },
];

export function Simulator() {
  const [profileId, setProfileId] = useState(PROFILES[0].id);
  const [state, setState] = useState<SimState>(PROFILES[0].state);
  const [log, setLog] = useState<Step[]>([]);

  function reset(id: string) {
    const p = PROFILES.find((x) => x.id === id) ?? PROFILES[0];
    setProfileId(p.id);
    setState(p.state);
    setLog([]);
  }

  function run(id: ActionId) {
    const [next, outcome] = apply(state, id);
    setState(next);
    setLog((l) => [{ outcome, state: next }, ...l].slice(0, 12));
  }

  const freeze = state.line === 'Active' || state.line === 'Frozen' ? pendingFreeze(state) : 'NotFrozen';

  return (
    <>
      <Window title="1 · Choose an agent">
        <p className="as-hero-body">
          Each of these is a profile Assay has actually seen. Pick one, then take actions and watch
          what the rules do.
        </p>
        <div className="as-sim-profiles">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`as-sim-profile${p.id === profileId ? ' is-active' : ''}`}
              onClick={() => reset(p.id)}
              aria-pressed={p.id === profileId}
            >
              <span className="as-sim-profile-name">{p.name}</span>
              <span className="as-sim-profile-blurb">{p.blurb}</span>
            </button>
          ))}
        </div>
      </Window>

      <Window
        title="2 · Take an action"
        accent={state.line === 'Frozen' ? 'frozen' : undefined}
      >
        <div className="as-sim-actions">
          {ACTIONS.filter((a) => a.show(state)).map((a) => {
            const why = a.disabled?.(state) ?? null;
            return (
              <button
                key={a.id}
                type="button"
                className="as-sim-action"
                onClick={() => run(a.id)}
                disabled={Boolean(why)}
                title={why ?? undefined}
              >
                <span className="as-sim-action-head">
                  <Icon name={a.icon} />
                  <span className="as-sim-action-label">{a.label}</span>
                </span>
                <span className="as-sim-action-promise">{why ?? a.promise}</span>
              </button>
            );
          })}
        </div>
      </Window>

      <div className="as-sim-split">
      <Window title="Agent state">
        <dl className="as-fields">
          <dt className="as-label">Credit line</dt>
          <dd className={state.line === 'Frozen' ? 'as-verdict-declined' : 'as-num'}>{state.line}</dd>

          <dt className="as-label">Ratings</dt>
          <dd className="as-num">
            {state.feedbackEntries} from {state.distinctRaters} client
            {state.distinctRaters === 1 ? '' : 's'}
          </dd>

          <dt className="as-label">Raters with an identity</dt>
          <dd className="as-num">{state.ratersWithIdentity}</dd>

          <dt className="as-label">Newest proof</dt>
          <dd className="as-num">
            {state.evidenceAgeDays.toFixed(1)} days old
            {state.evidenceAgeDays > E.maxEvidenceAgeDays ? ' · stale' : ''}
          </dd>

          <dt className="as-label">Identity transfers</dt>
          <dd className="as-num">{state.ownerChanges}</dd>

          <dt className="as-label">Wallet changes</dt>
          <dd className="as-num">{state.walletChanges}</dd>

          {state.limit > 0 ? (
            <>
              <dt className="as-label">Limit</dt>
              <dd className="as-num">{state.limit.toFixed(2)} tCTC</dd>
              <dt className="as-label">Drawn</dt>
              <dd className="as-num">{state.drawn.toFixed(2)} tCTC</dd>
              <dt className="as-label">Rate</dt>
              <dd className="as-num">{state.rateBps} bps</dd>
            </>
          ) : null}
        </dl>

        {freeze !== 'NotFrozen' ? (
          <p className="as-state as-state-alarm">
            <strong>A DRAW WOULD BE REFUSED</strong> — {FREEZE_EXPLAIN[freeze]}
          </p>
        ) : null}
      </Window>

      <Window title="3 · What happened">
        {log.length === 0 ? (
          <p className="as-hero-body">
            Nothing yet. Take an action above and the reasoning appears here, newest first.
          </p>
        ) : (
          <ol className="as-sim-log">
            {log.map((step, i) => (
              <li key={log.length - i} className={`as-sim-step is-${step.outcome.tone}`}>
                <span className="as-sim-step-icon">
                  <Icon name={step.outcome.icon} size={26} />
                </span>
                <div className="as-sim-step-body">
                  <p className="as-sim-step-title">{step.outcome.title}</p>
                  <p className="as-sim-step-summary">{step.outcome.summary}</p>
                  <p className="as-sim-step-because">{step.outcome.because}</p>
                  {step.outcome.rule ? (
                    <p className="as-sim-step-rule">
                      <span className="as-label">Decided by</span> <code>{step.outcome.rule}</code>
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Window>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The transitions. Each one mirrors a real code path.
 * ------------------------------------------------------------------ */

function apply(s: SimState, id: ActionId): [SimState, Outcome] {
  switch (id) {
    case 'apply': {
      const refusal = envelope(s);
      if (refusal) {
        return [
          s,
          {
            icon: 'cross',
            tone: 'bad',
            title: 'Refused before the underwriter was called',
            summary: 'No model ran. A deterministic rule declined it first.',
            because: refusal.detail,
            rule: `envelope: ${refusal.reason}`,
          },
        ];
      }

      const j = judge(s);
      if (!j.approve) {
        return [
          s,
          {
            icon: 'judge',
            tone: 'bad',
            title: 'Refused on judgment',
            summary: 'The evidence was usable, so the underwriter read it and declined anyway.',
            because: j.reasoning,
            rule: 'underwriter judgment, then the envelope clamps terms',
          },
        ];
      }

      return [
        {
          ...s,
          line: 'Offered',
          limit: j.limit,
          rateBps: j.rateBps,
          collateralRatio: j.collateralRatio,
          collateralPosted: 0,
          ownerChangesAtOffer: s.ownerChanges,
          walletChangesAtOffer: s.walletChanges,
        },
        {
          icon: 'check',
          tone: 'good',
          title: `Approved: ${j.limit.toFixed(2)} tCTC at ${j.rateBps} bps`,
          summary: `Collateral required: ${(j.limit * j.collateralRatio).toFixed(2)} tCTC (${Math.round(j.collateralRatio * 100)}%).`,
          because: j.reasoning,
          rule: 'underwriter judgment, within the policy envelope',
        },
      ];
    }

    case 'accept': {
      // The ratio the judgment actually demanded, not a fixed one. These
      // disagreed, so the offer promised one number and the line took another.
      const collateral = s.limit * s.collateralRatio;
      return [
        { ...s, line: 'Active', collateralPosted: collateral },
        {
          icon: 'credit',
          tone: 'good',
          title: 'Line active',
          summary: `${collateral.toFixed(2)} tCTC of collateral posted, the ${Math.round(s.collateralRatio * 100)}% the judgment required. The line is live.`,
          because:
            'The counters were snapshotted when the offer was made. Every draw from here compares against that snapshot, which is how a change after underwriting gets caught.',
          rule: 'CreditLine.accept',
        },
      ];
    }

    case 'draw': {
      const reason = pendingFreeze(s);
      if (reason !== 'NotFrozen') {
        return [
          { ...s, line: 'Frozen', freezeReason: reason },
          {
            icon: 'freeze',
            tone: 'bad',
            title: 'Draw refused, line frozen',
            summary: 'No funds left the pool.',
            because: FREEZE_EXPLAIN[reason],
            rule: `CreditLine.draw → freeze: ${reason}`,
          },
        ];
      }
      const amount = Math.min(s.limit - s.drawn, s.limit / 2);
      return [
        { ...s, drawn: s.drawn + amount },
        {
          icon: 'draw',
          tone: 'good',
          title: `Drew ${amount.toFixed(2)} tCTC`,
          summary: `${(s.drawn + amount).toFixed(2)} of ${s.limit.toFixed(2)} tCTC now outstanding.`,
          because:
            'All three freeze triggers were re-checked first and none had fired. The funds came from the lending pool, which real deposits fund.',
          rule: 'CreditLine.draw → LendingPool.lend',
        },
      ];
    }

    case 'repay': {
      const interest = s.drawn * (s.rateBps / 10_000);
      return [
        { ...s, line: 'Repaid', drawn: 0, collateralPosted: 0 },
        {
          icon: 'repay',
          tone: 'good',
          title: 'Repaid in full',
          summary: `${s.drawn.toFixed(2)} tCTC of principal plus ${interest.toFixed(2)} of interest. Collateral released.`,
          because:
            'Lenders earn that interest pro rata. A frozen line can still be repaid: freezing stops new credit, it does not seize anything.',
          rule: 'CreditLine.repay → LendingPool.repay',
        },
      ];
    }

    case 'sell': {
      const next = { ...s, ownerChanges: s.ownerChanges + 1 };
      return [
        next,
        {
          icon: 'identity',
          tone: 'neutral',
          title: 'Identity sold on Ethereum',
          summary:
            s.line === 'Active'
              ? 'The line is not frozen yet. Nothing on Creditcoin knows about this.'
              : 'The transfer is recorded on Ethereum.',
          because:
            'The sale happened on another chain. It becomes real to Assay only once the watcher proves it, roughly ten minutes later. Try drawing now and again after proving it.',
          rule: 'ERC-8004 Transfer event on Sepolia',
        },
      ];
    }

    case 'changeWallet': {
      return [
        { ...s, walletChanges: s.walletChanges + 1 },
        {
          icon: 'wallet',
          tone: 'neutral',
          title: 'Payment wallet changed',
          summary: 'Revenue now points at a different address.',
          because:
            'The registry has no dedicated event for this: setAgentWallet writes reserved metadata and emits MetadataSet. That is the only on-chain trace, and it is what the watcher looks for.',
          rule: 'MetadataSet with keccak256("agentWallet")',
        },
      ];
    }

    case 'age': {
      const days = s.evidenceAgeDays + 4;
      return [
        { ...s, evidenceAgeDays: days },
        {
          icon: 'clock',
          tone: 'neutral',
          title: 'Four days pass with nothing proven',
          summary: `The newest proof is now ${days.toFixed(1)} days old, past the ${E.maxEvidenceAgeDays} day bound.`,
          because:
            'Staleness is a freeze trigger in its own right. A record that was good last week is not evidence that the agent is working this week.',
          rule: `envelope: maxEvidenceAgeDays = ${E.maxEvidenceAgeDays}`,
        },
      ];
    }

    case 'proveFresh': {
      return [
        {
          ...s,
          feedbackEntries: s.feedbackEntries + 1,
          distinctRaters: s.distinctRaters + 1,
          ratersWithIdentity: s.ratersWithIdentity + 1,
          evidenceAgeDays: 0,
        },
        {
          icon: 'chain',
          tone: 'good',
          title: 'New work proven onto Creditcoin',
          summary: 'One more rating, from a client that holds its own identity.',
          because:
            'A rating is only worth as much as whoever left it. One from a party with its own proven identity carries weight that one from a bare address does not, and breadth is what the underwriter is looking for.',
          rule: 'AssayOracle.execute → FeedbackProven',
        },
      ];
    }
  }
}
