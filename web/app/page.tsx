import Link from 'next/link';

import { getPool } from '@/lib/agents';
import { getProvenFacts, type ProvenFact } from '@/lib/evidence';
import { REGISTRIES } from '@assay/config/chains';
import { DEPLOYMENTS } from '@assay/config/deployments';
import { EvidenceWindow } from './components/EvidenceWindow';
import { Meter } from './components/Meter';
import { truncate } from './components/TxLink';
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
  const [pool, factsResult] = await Promise.all([
    getPool().catch(() => null),
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

  return (
    <main className="as-page as-landing">
      <Window title="Assay" id="about" className="as-w-hero">
        <h1 className="as-hero-headline">
          Credit for autonomous agents,
          <br />
          underwritten on proof.
        </h1>
        <p className="as-hero-body">
          An agent that runs out of money stops working. Assay reads an agent’s work history from
          Ethereum, proves it on Creditcoin without a trusted oracle, and extends a credit line
          against it.
        </p>
        <p className="as-hero-actions">
          <Link className="as-button" href="/app">
            OPEN THE APP
          </Link>
          <a
            className="as-button"
            href="https://github.com/Samuel-Chuku"
            target="_blank"
            rel="noreferrer"
          >
            VIEW THE CODE ↗
          </a>
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

      <div className="as-steps as-w-steps">
        {STEPS.map((step) => (
          <Window key={step.title} title={step.title} dots={false}>
            <p className="as-step-body">{step.body}</p>
          </Window>
        ))}
      </div>

      <EvidenceWindow facts={facts} error={error} className="as-w-wide" />

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

      <Window title="Assay" dots={false} id="footer" className="as-w-footer">
        <dl className="as-fields">
          <dt className="as-label">Identity registry</dt>
          <dd className="as-proven as-num" title={REGISTRIES.identity}>
            {truncate(REGISTRIES.identity)}
          </dd>

          <dt className="as-label">Reputation registry</dt>
          <dd className="as-proven as-num" title={REGISTRIES.reputation}>
            {truncate(REGISTRIES.reputation)}
          </dd>

          <dt className="as-label">Oracle</dt>
          <dd className="as-num">{truncate(DEPLOYMENTS.assayOracle)}</dd>

          <dt className="as-label">Credit line</dt>
          <dd className="as-num">{truncate(DEPLOYMENTS.creditLine)}</dd>

          <dt className="as-label">Lending pool</dt>
          <dd className="as-num">{truncate(DEPLOYMENTS.lendingPool)}</dd>
        </dl>
        <p className="as-caption">
          The two registry addresses are rendered in proof blue because they are the trust anchor of
          the system: a fact is believed only if one of them emitted it. Built for BUIDL CTC 2026
          Fall · Attestcoin Protocol · AI track.
        </p>
      </Window>
    </main>
  );
}
