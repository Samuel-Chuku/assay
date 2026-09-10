import Link from 'next/link';

import { REGISTRIES, CREDITCOIN } from '@assay/config/chains';
import { DEPLOYMENTS } from '@assay/config/deployments';
import { getProvenFacts, type ProvenFact } from '@/lib/evidence';
import { ProofRow } from '../components/ProofRow';
import { truncate } from '../components/TxLink';
import { Window } from '../components/Window';

export const revalidate = 60;

export const metadata = {
  title: 'How Assay works',
  description:
    'How an agent’s work history is read from Ethereum, proven on Creditcoin without a trusted oracle, and turned into a credit line.',
};

/**
 * The explanation, long form.
 *
 * Built from the same components as everything else and, where it makes a claim
 * about proven data, it shows a real row rather than an illustration. A page
 * about verifiability that used a mock would undercut itself.
 */
export default async function HowItWorks() {
  let sample: ProvenFact | null = null;
  try {
    sample = (await getProvenFacts(4))[0] ?? null;
  } catch {
    sample = null;
  }

  return (
    <main className="as-page as-prose-page">
      <Window title="How it works" id="how">
        <h1 className="as-hero-headline">Work history as collateral.</h1>
        <p className="as-hero-body">
          An agent that runs out of money stops working. It pays for inference, gas and API calls
          before anyone pays it. No one lends to it, because it holds no collateral and no lender
          can read its history.
        </p>
        <p className="as-hero-body">
          That history exists. It sits in the ERC-8004 registries on Ethereum: who the agent is, who
          hired it, and what those clients said. The obstacle is that the history is on Ethereum and
          the lending happens on Creditcoin.
        </p>
      </Window>

      <Window title="01 · The oracle problem">
        <p className="as-hero-body">
          Moving a fact between two chains is normally an oracle problem. Someone watches Ethereum,
          reports to Creditcoin, and the whole system inherits that reporter&rsquo;s honesty. If they
          lie, or are compromised, every decision downstream is built on the lie.
        </p>
        <p className="as-hero-body">
          Attestcoin removes the reporter. Attestors sign what they observe on Ethereum, Creditcoin
          validators verify those signatures as part of consensus, and a precompile at{' '}
          <code>0x0FD2</code> confirms on chain that a transaction really was included in a valid
          Ethereum block. Nobody is asked to take anyone&rsquo;s word for anything.
        </p>
      </Window>

      <Window title="02 · What we refuse to believe">
        <p className="as-hero-body">
          Proving a transaction happened is not the same as believing what it says. Every proof runs
          five checks before a single value is stored.
        </p>
        <ol className="as-steps-list">
          <li>
            <strong>The transaction type is valid.</strong>
          </li>
          <li>
            <strong>The transaction succeeded.</strong> The precompile proves inclusion, not
            success. A reverted transaction is still validly included, and without this check a
            failed payment would underwrite as revenue.
          </li>
          <li>
            <strong>The event we asked for is present.</strong>
          </li>
          <li>
            <strong>The contract that emitted it is one of two hardcoded addresses.</strong> This is
            the whole security model, and the next window explains why.
          </li>
          <li>
            <strong>Only then does anything get stored.</strong>
          </li>
        </ol>
      </Window>

      <Window title="03 · Why the emitter is everything" accent="frozen">
        <p className="as-hero-body">
          Event signatures are public. Anyone can deploy a contract that emits a byte-identical
          feedback event with invented values, and prove that transaction to us. It really happened.
          It really succeeded. The precompile confirms all of it, and nothing about the proof is
          false.
        </p>
        <p className="as-hero-body">
          What makes that fact worthless is who emitted it. So the oracle compares the emitting
          address against two constants compiled into the contract, and skips anything else. Trust
          comes from the emitter, never from the payload.
        </p>
        <dl className="as-fields">
          <dt className="as-label">Identity registry</dt>
          <dd className="as-proven as-num" title={REGISTRIES.identity}>
            {truncate(REGISTRIES.identity)}
          </dd>
          <dt className="as-label">Reputation registry</dt>
          <dd className="as-proven as-num" title={REGISTRIES.reputation}>
            {truncate(REGISTRIES.reputation)}
          </dd>
        </dl>
        <p className="as-caption">
          These two addresses are the trust anchor of the system. Assay did not deploy them and
          cannot write to them.
        </p>
      </Window>

      {sample ? (
        <Window title="04 · What a proven fact looks like">
          <p className="as-hero-body">
            One real fact, read from the chain when this page was built. The emitter line is the
            check above. The two links are the same event on Ethereum and its verification on
            Creditcoin. The delay is measured from the two block timestamps, not asserted.
          </p>
          <div className="as-evidence-rows as-evidence-single">
            <ProofRow fact={sample} />
          </div>
        </Window>
      ) : null}

      <Window title="05 · Ten minutes, on purpose">
        <p className="as-hero-body">
          A fact takes roughly ten minutes to become provable. That is attestation deliberately
          waiting out the risk that Ethereum reorganises and un-does the block it just signed for.
          It is not a queue, it is not tunable, and it is a property of the product rather than a
          defect.
        </p>
        <p className="as-hero-body">
          The practical consequence is that credit decisions settle in about ten minutes, and the
          block heights in the menu bar above show exactly how far behind the attestor network
          currently is.
        </p>
      </Window>

      <Window title="06 · The judgment">
        <p className="as-hero-body">
          An underwriter reads the proven facts, and only the proven facts. It never touches
          Ethereum directly, so a decision can never rest on data an attacker could fabricate.
        </p>
        <p className="as-hero-body">
          It weighs things a formula cannot. Many jobs for one payer is a relationship, not a track
          record. A rater holding its own registered identity has staked something; a rater holding
          nothing is an address someone made. Feedback is permissionless, so the number attached to
          an entry means little next to who wrote it and how many distinct parties did.
        </p>
        <p className="as-hero-body">
          It has to justify itself in writing, and that reasoning is hashed onto the chain when a
          line is offered. Your browser recomputes the hash on the agent pages, so the reasoning you
          read is provably the reasoning the contract was given.
        </p>
        <p className="as-hero-body">
          Deterministic rails sit either side of the judgment. Unusable evidence is refused before
          any model is called, and terms outside policy are clamped afterwards. Those rails bound
          what a verdict may contain. They never decide what it should conclude.
        </p>
      </Window>

      <Window title="07 · When the ground moves" accent="frozen">
        <p className="as-hero-body">
          An ERC-8004 identity is a transferable token, and its payment wallet can be swapped. Both
          are attacks. An agent can build a record, borrow against it, then sell the identity to
          someone with no history at all.
        </p>
        <p className="as-hero-body">
          So the line snapshots the agent&rsquo;s state when it is offered, and re-checks at every
          draw. If the identity has changed hands, if the payment wallet has moved, or if the newest
          evidence is past its freshness bound, the line stops extending credit. Absent evidence is
          never treated as good evidence.
        </p>
        <p className="as-hero-body">
          <Link href="/app/10195">Agent 10195</Link> is the live example. It was underwritten on a
          genuine record, given a line, and then its identity was sold on Ethereum. The system
          proved the transfer, froze the line and re-refused the agent without anyone intervening.
        </p>
      </Window>

      <Window title="08 · The money">
        <p className="as-hero-body">
          Anyone can deposit into the pool and earn the interest agents pay. Lenders absorb losses
          pro rata, which is what makes it a market rather than a faucet. An agent posts partial
          collateral to activate its line, then draws against it, spends it working, and repays.
        </p>
        <p className="as-hero-body">
          What a proven history buys is the portion of the line above the collateral. A stronger
          record earns a lower ratio. Calling this uncollateralised lending would overstate it.
        </p>
      </Window>

      <Window title="What this cannot do" accent="frozen">
        <p className="as-hero-body">
          There is no write-back to Ethereum. Attestcoin writability is still in audit, so a default
          is recorded on Creditcoin only and an agent that defaults here keeps a clean record on
          Ethereum. Closing that loop is the obvious next step.
        </p>
        <p className="as-hero-body">
          The oracle is trustless. The underwriter is not. Only one address can offer a line, and it
          is ours. Independent underwriters are not built.
        </p>
        <p className="as-hero-body">
          Recourse ends at the collateral, and everything here runs on testnet.
        </p>
      </Window>

      <Window title="Addresses" dots={false}>
        <dl className="as-fields">
          <dt className="as-label">Oracle</dt>
          <dd className="as-num">
            <a href={`${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.assayOracle}`} target="_blank" rel="noreferrer">
              {truncate(DEPLOYMENTS.assayOracle)} ↗
            </a>
          </dd>
          <dt className="as-label">Credit line</dt>
          <dd className="as-num">
            <a href={`${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.creditLine}`} target="_blank" rel="noreferrer">
              {truncate(DEPLOYMENTS.creditLine)} ↗
            </a>
          </dd>
          <dt className="as-label">Lending pool</dt>
          <dd className="as-num">
            <a href={`${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.lendingPool}`} target="_blank" rel="noreferrer">
              {truncate(DEPLOYMENTS.lendingPool)} ↗
            </a>
          </dd>
        </dl>
        <p className="as-caption">
          Full technical detail, including the failure modes found by running the system, is in
          docs/attestcoin-integration.md in the repository.
        </p>
      </Window>
    </main>
  );
}
