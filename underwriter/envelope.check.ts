/**
 * Assertions for the deterministic halves of the underwriter.
 *
 * Run with `pnpm test:underwriter`. Uses node:assert rather than a test runner,
 * because the envelope and the cache are the only TypeScript worth asserting on
 * and adding a framework for them would not earn its keep.
 *
 * What these protect: the envelope can only ever tighten a judgment, and the
 * evidence hash must ignore read-time noise while catching every real change.
 */
import assert from 'node:assert/strict';

import { UNDERWRITING_ENVELOPE as E } from '../config/underwriting';
import { clamp, preflight, refusalVerdict } from './envelope';
import { evidenceHash } from './cache';
import type { EvidenceBundle, ProvenFeedback } from './evidence';
import { extractSignals } from './signals';
import type { Verdict } from './verdict';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const approval: Verdict = {
  approve: true,
  credit_limit: '5.0',
  collateral_ratio: 0.05,
  rate_bps: 100,
  confidence: 0.8,
  reasoning: 'x'.repeat(60),
  evidence_used: ['something'],
};

function feedback(client: string, index: number, holdsIdentity = true): ProvenFeedback {
  return {
    client,
    value: 90,
    valueDecimals: 2,
    feedbackIndex: index,
    tag1Hash: '0x' + '11'.repeat(32),
    clientHoldsProvenIdentity: holdsIdentity,
  };
}

function bundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    agentId: 1,
    proven: true,
    owner: '0xAAAA000000000000000000000000000000000001',
    currentOwner: '0xAAAA000000000000000000000000000000000001',
    paymentWallet: '0x0000000000000000000000000000000000000000',
    provenAtBlock: 100,
    lastEvidenceBlock: 100,
    evidenceAgeBlocks: 10,
    ownerChanges: 0,
    walletChanges: 0,
    feedback: [feedback('0xC1', 1), feedback('0xC2', 1)],
    provenance: {
      oracle: '0xORACLE'.padEnd(42, '0'),
      chain: 'test',
      sourceChain: 'test',
      readAtBlock: 110,
      proofTransactions: ['0xtx'],
    },
    ...overrides,
  };
}

console.log('envelope');

check('clamp caps a limit above policy', () => {
  const { verdict, adjustments } = clamp(approval);
  assert.equal(verdict.credit_limit, E.maxCreditLimit);
  assert.ok(adjustments.some((a) => a.includes('credit limit reduced')));
});

check('clamp raises collateral to the floor', () => {
  const { verdict } = clamp(approval);
  assert.equal(verdict.collateral_ratio, E.minCollateralRatio);
});

check('clamp raises a rate below the floor', () => {
  const { verdict } = clamp(approval);
  assert.equal(verdict.rate_bps, E.minRateBps);
});

check('clamp caps a rate above the ceiling', () => {
  const { verdict } = clamp({ ...approval, rate_bps: 9_000 });
  assert.equal(verdict.rate_bps, E.maxRateBps);
});

check('clamp never loosens a conservative judgment', () => {
  const conservative: Verdict = {
    ...approval,
    credit_limit: '0.25',
    collateral_ratio: 0.9,
    rate_bps: 2_000,
  };
  const { verdict, adjustments } = clamp(conservative);
  assert.equal(verdict.credit_limit, '0.25');
  assert.equal(verdict.collateral_ratio, 0.9);
  assert.equal(verdict.rate_bps, 2_000);
  assert.equal(adjustments.length, 0);
});

check('clamp strips phantom terms from a refusal', () => {
  const { verdict } = clamp({ ...approval, approve: false });
  assert.equal(verdict.credit_limit, '0');
  assert.equal(verdict.collateral_ratio, 0);
  assert.equal(verdict.rate_bps, 0);
});

console.log('\npreflight');

check('passes usable evidence', () => {
  const e = bundle();
  assert.equal(preflight(e, extractSignals(e)).refuse, false);
});

check('refuses a transferred identity', () => {
  const e = bundle({ ownerChanges: 1 });
  const gate = preflight(e, extractSignals(e));
  assert.equal(gate.refuse, true);
  assert.equal(gate.refuse && gate.reason, 'identity-transferred');
});

check('refuses a changed payment wallet', () => {
  const e = bundle({ walletChanges: 1 });
  const gate = preflight(e, extractSignals(e));
  assert.equal(gate.refuse && gate.reason, 'payment-wallet-changed');
});

check('refuses an empty record', () => {
  const e = bundle({ feedback: [] });
  const gate = preflight(e, extractSignals(e));
  assert.equal(gate.refuse && gate.reason, 'no-record');
});

check('a deterministic refusal carries no terms and says why', () => {
  const e = bundle({ ownerChanges: 1 });
  const gate = preflight(e, extractSignals(e));
  assert.ok(gate.refuse);
  if (!gate.refuse) return;
  const v = refusalVerdict(gate, e);
  assert.equal(v.approve, false);
  assert.equal(v.credit_limit, '0');
  assert.ok(v.reasoning.includes('deterministic rule'));
});

/**
 * The envelope must not judge quality. A record that is numerically weak but
 * whose evidence is sound has to reach the judge, or the formula has quietly
 * taken over.
 */
check('does not refuse a weak but sound record', () => {
  const e = bundle({ feedback: [feedback('0xC1', 1, false)] });
  assert.equal(preflight(e, extractSignals(e)).refuse, false);
});

console.log('\nevidence hash');

check('ignores read-time noise', () => {
  const a = bundle();
  const b = bundle({ evidenceAgeBlocks: 99_999 });
  b.provenance.readAtBlock = 999_999;
  assert.equal(evidenceHash(a), evidenceHash(b));
});

check('ignores the order feedback comes back in', () => {
  const a = bundle();
  const b = bundle({ feedback: [...bundle().feedback].reverse() });
  assert.equal(evidenceHash(a), evidenceHash(b));
});

check('changes when a fact changes', () => {
  assert.notEqual(evidenceHash(bundle()), evidenceHash(bundle({ ownerChanges: 1 })));
  assert.notEqual(evidenceHash(bundle()), evidenceHash(bundle({ feedback: [feedback('0xC1', 1)] })));
});

check('changes when a counterparty loses standing', () => {
  const a = bundle({ feedback: [feedback('0xC1', 1, true)] });
  const b = bundle({ feedback: [feedback('0xC1', 1, false)] });
  assert.notEqual(evidenceHash(a), evidenceHash(b));
});

console.log(`\n${passed} assertions passed.`);
