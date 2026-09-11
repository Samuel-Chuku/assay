import Link from 'next/link';

import { getAgents, getPool, type Agent } from '@/lib/agents';
import { getProvenFacts, type ProvenFact } from '@/lib/evidence';
import { EvidenceWindow } from './components/EvidenceWindow';
import { Meter } from './components/Meter';
import { Window } from './components/Window';

export const revalidate = 60;

const STEPS = [
  {
    title: '01 · History',
    body: 'The agent’s identity and feedback live in the ERC-8004 registries on Ethereum. Assay did not deploy them and cannot write to them.',
  },
  {
    title: '02 · Proof',
    body: 'Attestors sign what they see on Ethereum. Creditcoin validators verify the signatures. A precompile confirms the transaction on-chain. No operator to trust.',
  },
  {
    title: '03 · Judgment',
    body: 'An underwriter reads only proven facts and forms a view: how much credit, at what collateral ratio, or none at all, with written reasoning.',
  },
  {
    title: '04 · Credit',
    body: 'Lenders fund a pool. The agent draws against its line, spends it working, and repays from what it earns.',
  },
];

export default async function Page() {
  const [pool, agents_, factsResult] = await Promise.all([
    getPool().catch(() => null),
    getAgents().catch(() => []),
    getProvenFacts().then(
      (facts) => ({ facts, error: undefined as string | undefined }),
      (cause: unknown) => ({
        facts: [] as ProvenFact[],
        error: cause instanceof Error ? cause.message : String(cause),
      })
    ),
  ]);

  const { facts, error } = factsResult;
  const agents = new Set(facts.map((f) => f.agentId));

  /**
   * The landing page states four outcomes. Deriving them from live state rather
   * than listing them in prose means the claim cannot quietly go stale, and a
   * reader can click straight through to the evidence behind any row.
   */
  const agentRows = agents_.map((a) => ({
    agentId: a.agentId,
    approved: a.verdict?.approve ?? false,
    verdictLabel: a.verdict ? (a.verdict.approve ? 'APPROVED' : 'DECLINED') : 'NOT UNDERWRITTEN',
    lineLabel: a.line ? a.line.state : 'no line',
    why: whyLine(a),
  }));

  return (
    <main className="as-page as-landing">
      {/*
        The one thing on the site that is not a window. A short, full-width
        statement of what this is, before the desktop of evidence begins, so a
        first-time visitor is not asked to read five panels to find out.
      */}
      <section className="as-hero" id="about">
        <p className="as-hero-kicker">
          <span aria-hidden="true">▤</span> Assay · credit for autonomous agents
        </p>
        <h1 className="as-hero-title">
          Work history as collateral.
        </h1>
        <p className="as-hero-sub">
          An agent&rsquo;s record on Ethereum, proven onto Creditcoin with no one to trust, judged by
          an underwriter that has to explain itself, and lent against by real depositors.
        </p>
        <p className="as-hero-actions">
          <Link className="as-button as-button-primary as-button-lg" href="/app">
            OPEN THE APP
          </Link>
          <Link className="as-button as-button-lg" href="/simulator">
            TRY THE SIMULATOR
          </Link>
        </p>
      </section>

      <Window title="The problem" id="problem" className="as-w-problem">
        <p className="as-hero-body">
          Agents pay for inference, gas, and API calls before anyone pays them. When the balance hits
          zero, the agent stalls mid-task.
        </p>
        <p className="as-hero-body">
          No one lends to them. They hold no collateral, and their work history is scattered across
          chains no lender can read.
        </p>
      </Window>
      <Window title="Live" id="live" className="as-w-live">
        <Meter
          label="proven facts"
          kind="attestation"
          fraction={facts.length === 0 ? 0 : 1}
          value={`${facts.length}`}
        />
        <Meter
          label="agents"
          kind="attestation"
          fraction={agents.size === 0 ? 0 : 1}
          value={`${agents.size}`}
        />
        <Meter
          label="utilisation"
          kind="utilisation"
          fraction={pool?.utilisation ?? 0}
          value={pool ? `${Math.round(pool.utilisation * 100)}%` : '—'}
        />
        <p className="as-caption">
          Read from Creditcoin when this page was built, not written by hand.
        </p>
      </Window>

      <Window title="See it for yourself" id="try" className="as-w-try">
        <p className="as-hero-body">
          The interesting behaviour is what happens when something goes wrong: an agent builds a
          record, borrows against it, then sells its identity to someone with no history at all.
        </p>
        <p className="as-hero-body">
          The simulator runs the real rules, in the real order, with the same reason strings the
          deployed system uses. No wallet, nothing spent.
        </p>
        <p className="as-hero-actions">
          <Link className="as-button as-button-primary" href="/simulator">
            RUN THE SIMULATOR
          </Link>
        </p>
      </Window>


      <div className="as-steps as-w-steps">
        {STEPS.map((step) => (
          <Window key={step.title} title={step.title} dots={false}>
            <p className="as-step-body">{step.body}</p>
          </Window>
        ))}
      </div>

      <EvidenceWindow facts={facts} error={error} className="as-w-wide" />

      <Window title="Every agent, and what happened to it" id="outcomes" className="as-w-wide">
        <p className="as-hero-body">
          Every row is live state read from Creditcoin, not a fixture. The verdict column is the
          underwriter&rsquo;s current judgment; the line column is what the contract is actually
          doing about it.
        </p>
        {agentRows.length === 0 ? (
          <p className="as-state">
            <strong>AGENTS UNAVAILABLE</strong> — Creditcoin did not answer while this page was
            built. Nothing is shown rather than something unverified.
          </p>
        ) : (
          <ul className="as-outcome-list">
            {agentRows.map((a) => (
              <li key={a.agentId}>
                <Link className="as-outcome" href={`/app/${a.agentId}`}>
                  <span className="as-outcome-id">#{a.agentId}</span>
                  <span
                    className={
                      a.approved ? 'as-outcome-verdict is-yes' : 'as-outcome-verdict is-no'
                    }
                  >
                    {a.verdictLabel}
                  </span>
                  <span className="as-outcome-line">{a.lineLabel}</span>
                  <span className="as-outcome-why">{a.why}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Window>

      <Window title="What this cannot do" accent="frozen" id="limits" className="as-w-limits">
        <p className="as-hero-body">
          Settlement takes about ten minutes. Attestation deliberately waits out source-chain
          reversion risk, and that delay is not tunable.
        </p>
        <p className="as-hero-body">
          There is no write-back to Ethereum. Attestcoin writability is still in audit, so a default
          is recorded on Creditcoin only.
        </p>
        <p className="as-hero-body">
          One underwriter, one operator. Independent underwriters are the obvious next step and are
          not built.
        </p>
        <p className="as-hero-body">Testnet only.</p>
      </Window>

    </main>
  );
}

/** One line on why an agent ended where it did, from its own state. */
function whyLine(a: Agent): string {
  // Line state first: an agent that borrowed and repaid is described by that,
  // not by whatever its evidence looks like now.
  if (a.line?.state === 'Repaid') return 'borrowed and repaid in full';
  if (a.ownerChanges > 0) return 'identity sold after underwriting';
  if (a.walletChanges > 0) return 'payment wallet changed after underwriting';
  if (a.feedbackCount === 0) return 'no proven record to read';
  if (!a.verdict) return 'proven, but never applied for credit';
  if (!a.verdict.approve) return 'usable evidence, declined on judgment';
  return `${a.feedbackCount} proven facts, approved`;
}
