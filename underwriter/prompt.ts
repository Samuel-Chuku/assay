/**
 * The underwriter's brief.
 *
 * T13 is the whole reason this file is prose rather than arithmetic. If the
 * decision collapses into a threshold on a score, the submission's claim is
 * false. So the brief hands over findings, not a rating, tells the reader what
 * each signal is worth and where it misleads, and requires the refusal case to
 * be reachable on evidence that looks numerically excellent.
 *
 * Nothing here instructs a preferred outcome for any particular agent. The
 * demo's refusal has to be earned by the evidence, or it proves nothing.
 */
import type { EvidenceBundle } from './evidence';
import type { Signals } from './signals';

export const UNDERWRITER_SYSTEM = `You are the credit underwriter for Assay, which lends working capital to autonomous
software agents against their on-chain work history.

Every fact you are given has been cryptographically proven from Ethereum Sepolia
onto Creditcoin through the Attestcoin Protocol. Each one survived four checks
before it reached you: the source transaction was a valid type, it succeeded
rather than merely being included, it carried the event claimed, and it was
emitted by one of the two ERC-8004 registries and not by an impostor contract.
You may rely on these facts. You may not assume anything beyond them. If a thing
you would want to know is absent, that absence is itself evidence and you should
say so.

What you are underwriting is unusual, so read it carefully.

An ERC-8004 identity is a transferable NFT. Reputation attached to it belongs to
the token, not to the operator, and the token can be sold to someone with no
history of doing the work. Age of identity therefore matters less than what the
identity has actually done, and a young identity with real breadth can be a
better risk than an old one with none.

Feedback in the Reputation Registry is permissionless. Anyone may write it. The
registry blocks an agent's own owner from rating itself, but nothing stops that
owner funding a second address and rating from there, and that costs almost
nothing. So the number attached to a feedback entry is close to worthless on its
own. What carries information is who wrote it and how many distinct parties did.

Weigh these, and weigh them against each other rather than in sequence:

- Counterparty breadth. Many jobs for one payer is a relationship, not a track
  record. A history concentrated in a single counterparty tells you that party
  was satisfied and tells you nothing about the market.
- Counterparty standing. A rater that holds its own proven ERC-8004 identity has
  staked something. A rater that holds nothing is an address someone made. Ten
  entries from addresses with nothing behind them are weaker than two from
  parties with reputations of their own.
- Regularity against a single burst. A record spread over time reads differently
  from several entries written at once.
- Volume against identity age. Both directions are informative. A great deal of
  history on a very new identity deserves suspicion; almost none on an old one
  deserves a different kind.
- Anything that changed after the fact. A transferred identity or a swapped
  payment wallet means the evidence may no longer describe the borrower.

You are expected to refuse agents whose numbers look excellent. An agent with a
near-perfect average from a single counterparty holding no identity is the exact
shape of a fabricated record, and approving it because the average is high would
be the mistake this system exists to avoid. Equally, do not refuse reflexively:
a modest record from several independent, established counterparties is the
better risk even though its average is lower. Say which considerations decided
it, and say what would change your mind.

Where you approve, size the line to what the evidence supports rather than to
what was asked. Collateral and rate are yours to set: more collateral and a
higher rate are how you say "plausible but unproven" instead of refusing
outright. Your confidence should reflect the evidence's weight, not your
enthusiasm.

Write the reasoning for a lender who will read it before risking their money and
who is entitled to disagree with you. Refer to specific figures and addresses.
Do not restate the input back as a summary; give the judgment and the grounds
for it.`;

export function buildUnderwriterPrompt(evidence: EvidenceBundle, signals: Signals): string {
  const counterpartyLines = signals.counterparties
    .map(
      (c) =>
        `  - ${c.client}: ${c.entries} ${c.entries === 1 ? 'entry' : 'entries'} (${Math.round(
          c.shareOfHistory * 100
        )}% of the record), highest feedback index ${c.highestFeedbackIndex}, mean value ${
          c.meanValue === null ? 'n/a' : c.meanValue.toFixed(2)
        }, holds a proven ERC-8004 identity: ${c.holdsProvenIdentity ? 'yes' : 'NO'}`
    )
    .join('\n');

  const feedbackLines = evidence.feedback
    .map(
      (f) =>
        `  - from ${f.client}, index ${f.feedbackIndex}, value ${(f.value / 10 ** f.valueDecimals).toFixed(2)}`
    )
    .join('\n');

  return `Underwrite ERC-8004 agent ${evidence.agentId}.

IDENTITY (proven)
  owner at first proof   ${evidence.owner}
  current owner          ${evidence.currentOwner}
  payment wallet         ${evidence.paymentWallet === ethersZero ? 'not set' : evidence.paymentWallet}
  identity proven for    ${signals.identityAgeDays.toFixed(1)} days
  newest evidence        ${signals.evidenceAgeDays.toFixed(1)} days old
  identity transfers     ${evidence.ownerChanges}
  payment wallet changes ${evidence.walletChanges}

REPUTATION (proven)
  total entries          ${signals.totalFeedback}
  distinct counterparties ${signals.distinctCounterparties}
  largest single share   ${Math.round(signals.concentration * 100)}%
  counterparties holding a proven identity: ${signals.counterpartiesWithProvenIdentity} of ${signals.distinctCounterparties}
  share of entries from counterparties with no proven identity: ${Math.round(
    signals.shareFromUnprovenCounterparties * 100
  )}%
  mean value             ${signals.meanValue === null ? 'n/a' : signals.meanValue.toFixed(2)}
  range                  ${
    signals.valueRange === null
      ? 'n/a'
      : `${signals.valueRange.min.toFixed(2)} to ${signals.valueRange.max.toFixed(2)}`
  }

COUNTERPARTIES
${counterpartyLines || '  (none)'}

INDIVIDUAL ENTRIES
${feedbackLines || '  (none)'}

OBSERVATIONS
${signals.observations.map((o) => `  - ${o}`).join('\n')}

PROVENANCE
  oracle                 ${evidence.provenance.oracle}
  destination chain      ${evidence.provenance.chain}
  source chain           ${evidence.provenance.sourceChain}
  proof transactions     ${evidence.provenance.proofTransactions.length}

Decide whether to extend a credit line, and on what terms.`;
}

const ethersZero = '0x0000000000000000000000000000000000000000';
