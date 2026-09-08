/**
 * Decides empirically whether a model is good enough to be Assay's underwriter.
 *
 * Usage:
 *   pnpm underwrite:qualify                        the configured judge
 *   pnpm underwrite:qualify <model> [<model> ...]  any model ids your endpoint serves
 *
 * The test is the demo itself. Agent 10155 has a modest record spread across
 * three counterparties that each hold a proven identity. Agent 10156 has better
 * raw numbers, all of them written by one address holding nothing. A model that
 * reads averages approves 10156. A model that reads evidence refuses it.
 *
 * The deterministic rails cannot decide this. They bound what a verdict may
 * contain, never what it should conclude, so the only honest way to know whether
 * a cheaper judge can do the job is to hand it the real dossiers and look.
 *
 * This spends money on every run: two calls per candidate, no cache. Cost is
 * reported per candidate so the tradeoff is visible rather than assumed.
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';

import { LLM_MODEL } from '../config/underwriting';
import { gatherEvidence } from '../underwriter/evidence';
import { extractSignals } from '../underwriter/signals';
import { buildUnderwriterPrompt, UNDERWRITER_SYSTEM } from '../underwriter/prompt';
import { clamp, preflight } from '../underwriter/envelope';
import { judge } from '../underwriter/judge';

type Seed = { agents: Record<string, { agentId: number }> };

type Expectation = { key: 'approved' | 'refused'; agentId: number; shouldApprove: boolean; why: string };

async function main(): Promise<void> {
  const models = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const under = models.length > 0 ? models : [LLM_MODEL];

  const seed = JSON.parse(readFileSync('config/demo-agents.json', 'utf8')) as Seed;
  const expectations: Expectation[] = [
    {
      key: 'approved',
      agentId: seed.agents.approved.agentId,
      shouldApprove: true,
      why: 'three distinct counterparties, all holding proven identities',
    },
    {
      key: 'refused',
      agentId: seed.agents.refused.agentId,
      shouldApprove: false,
      why: 'better numbers, but 100% from one address holding no identity',
    },
  ];

  // Gather once; every model reads the identical dossier.
  const dossiers = new Map<number, string>();
  for (const e of expectations) {
    const evidence = await gatherEvidence(e.agentId);
    const signals = extractSignals(evidence);
    const gate = preflight(evidence, signals);
    if (gate.refuse) {
      throw new Error(
        `Agent ${e.agentId} is refused deterministically (${gate.reason}), so it cannot test judgment.`
      );
    }
    dossiers.set(e.agentId, buildUnderwriterPrompt(evidence, signals));
  }

  console.log('Qualifying against the two demo agents.\n');
  for (const e of expectations) {
    console.log(`  agent ${e.agentId} (${e.key}): expect ${e.shouldApprove ? 'APPROVE' : 'REFUSE'} — ${e.why}`);
  }

  const summary: { model: string; passed: number; cost: number; note: string }[] = [];

  for (const model of under) {
    console.log(`\n${'='.repeat(72)}\n${model}\n${'='.repeat(72)}`);
    let passed = 0;
    let cost = 0;
    let note = '';

    for (const e of expectations) {
      try {
        const judgment = await judge(UNDERWRITER_SYSTEM, dossiers.get(e.agentId)!, model);
        const held = clamp(judgment.verdict);
        const correct = held.verdict.approve === e.shouldApprove;
        if (correct) passed++;
        cost += judgment.usage.costUsd ?? 0;

        console.log(
          `\n  agent ${e.agentId}  ${held.verdict.approve ? 'APPROVED' : 'REFUSED'}  ${
            correct ? 'as expected' : '*** WRONG ***'
          }`
        );
        console.log(
          `    limit ${held.verdict.credit_limit} tCTC, collateral ${held.verdict.collateral_ratio}, ${held.verdict.rate_bps} bps, confidence ${held.verdict.confidence}`
        );
        console.log(`    ${held.verdict.reasoning.replace(/\s+/g, ' ').slice(0, 400)}...`);
      } catch (error) {
        note = (error as Error).message.split('\n')[0].slice(0, 120);
        console.log(`\n  agent ${e.agentId}  FAILED: ${note}`);
      }
    }

    summary.push({ model, passed, cost, note });
  }

  console.log(`\n${'='.repeat(72)}\nSummary\n${'='.repeat(72)}`);
  console.log(`${'model'.padEnd(44)} ${'result'.padEnd(10)} cost`);
  for (const s of summary) {
    const verdict = s.passed === 2 ? 'PASS 2/2' : `FAIL ${s.passed}/2`;
    const cost = s.cost > 0 ? `$${s.cost.toFixed(5)}` : 'n/a';
    console.log(`${s.model.padEnd(44)} ${verdict.padEnd(10)} ${cost}${s.note ? `  (${s.note})` : ''}`);
  }
  console.log('\nA judge that passes 2/2 can tell a good record from a well-decorated one.');
  console.log('One that does not will approve the fabricated agent in your demo.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
