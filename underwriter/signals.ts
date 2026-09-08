/**
 * Turns a bundle of proven facts into the observations a reader needs.
 *
 * This module deliberately produces **no score and no recommendation** (T13). If
 * it returned a number that a threshold could act on, the underwriter would
 * collapse into that threshold and the judgment would be fake. What it produces
 * is closer to a set of findings: how concentrated the history is, who the
 * counterparties are, whether they staked anything, how the record sits against
 * the identity's age. Weighing those against each other is the judge's job, and
 * reasonable readers can weigh them differently.
 */
import { CREDITCOIN_BLOCKS_PER_DAY } from '../config/demo';
import type { EvidenceBundle } from './evidence';

export type CounterpartySignal = {
  client: string;
  entries: number;
  /** Share of all feedback this one counterparty wrote, 0 to 1. */
  shareOfHistory: number;
  holdsProvenIdentity: boolean;
  highestFeedbackIndex: number;
  meanValue: number | null;
};

export type Signals = {
  agentId: number;
  totalFeedback: number;
  distinctCounterparties: number;
  /** Largest share written by any single counterparty, 0 to 1. */
  concentration: number;
  counterpartiesWithProvenIdentity: number;
  /** Share of entries written by counterparties that hold no proven identity. */
  shareFromUnprovenCounterparties: number;
  meanValue: number | null;
  valueRange: { min: number; max: number } | null;
  identityAgeDays: number;
  evidenceAgeDays: number;
  ownerChanges: number;
  walletChanges: number;
  counterparties: CounterpartySignal[];
  /** Plain-language observations, each one a fact rather than a verdict. */
  observations: string[];
};

function scaled(value: number, decimals: number): number {
  return value / 10 ** decimals;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function extractSignals(evidence: EvidenceBundle): Signals {
  const byClient = new Map<string, typeof evidence.feedback>();
  for (const entry of evidence.feedback) {
    const key = entry.client.toLowerCase();
    byClient.set(key, [...(byClient.get(key) ?? []), entry]);
  }

  const total = evidence.feedback.length;
  const counterparties: CounterpartySignal[] = [...byClient.entries()].map(([client, entries]) => ({
    client,
    entries: entries.length,
    shareOfHistory: total === 0 ? 0 : entries.length / total,
    holdsProvenIdentity: entries[0].clientHoldsProvenIdentity,
    highestFeedbackIndex: Math.max(...entries.map((e) => e.feedbackIndex)),
    meanValue: mean(entries.map((e) => scaled(e.value, e.valueDecimals))),
  }));
  counterparties.sort((a, b) => b.entries - a.entries);

  const values = evidence.feedback.map((e) => scaled(e.value, e.valueDecimals));
  const unprovenEntries = evidence.feedback.filter((e) => !e.clientHoldsProvenIdentity).length;
  const concentration = counterparties.length === 0 ? 0 : counterparties[0].shareOfHistory;

  const identityAgeDays = (evidence.provenance.readAtBlock - evidence.provenAtBlock) / CREDITCOIN_BLOCKS_PER_DAY;
  const evidenceAgeDays = evidence.evidenceAgeBlocks / CREDITCOIN_BLOCKS_PER_DAY;

  const observations: string[] = [];
  if (total === 0) {
    observations.push('No proven feedback at all. There is no track record to read.');
  } else {
    observations.push(
      `${total} proven feedback ${total === 1 ? 'entry' : 'entries'} from ${counterparties.length} distinct ${
        counterparties.length === 1 ? 'counterparty' : 'counterparties'
      }.`
    );
    if (counterparties.length === 1) {
      observations.push(
        `Every entry was written by one address, ${counterparties[0].client}. Repeat business from a single payer is not the same as a track record across a market.`
      );
    } else if (concentration >= 0.5) {
      observations.push(
        `${Math.round(concentration * 100)}% of the history was written by a single counterparty.`
      );
    }
    if (unprovenEntries > 0) {
      observations.push(
        `${unprovenEntries} of ${total} entries came from addresses holding no ERC-8004 identity we have proven. Feedback is permissionless, so an address with nothing staked behind it costs nothing to create.`
      );
    }
    const repeat = counterparties.filter((c) => c.highestFeedbackIndex > 1);
    if (repeat.length > 0) {
      observations.push(
        `Highest feedback index per counterparty: ${repeat
          .map((c) => `${c.client.slice(0, 10)} at ${c.highestFeedbackIndex}`)
          .join(', ')}. The index counts repeats from the same payer.`
      );
    }
  }
  if (evidence.ownerChanges > 0) {
    observations.push(`The identity has changed hands ${evidence.ownerChanges} time(s) since it was first proven.`);
  }
  if (evidence.walletChanges > 0) {
    observations.push(`The payment wallet has changed ${evidence.walletChanges} time(s).`);
  }
  observations.push(
    `Identity has been proven on Creditcoin for ${identityAgeDays.toFixed(1)} days; newest evidence is ${evidenceAgeDays.toFixed(1)} days old.`
  );

  return {
    agentId: evidence.agentId,
    totalFeedback: total,
    distinctCounterparties: counterparties.length,
    concentration,
    counterpartiesWithProvenIdentity: counterparties.filter((c) => c.holdsProvenIdentity).length,
    shareFromUnprovenCounterparties: total === 0 ? 0 : unprovenEntries / total,
    meanValue: mean(values),
    valueRange: values.length === 0 ? null : { min: Math.min(...values), max: Math.max(...values) },
    identityAgeDays,
    evidenceAgeDays,
    ownerChanges: evidence.ownerChanges,
    walletChanges: evidence.walletChanges,
    counterparties,
    observations,
  };
}
