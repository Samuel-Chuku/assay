/**
 * Underwrites one agent.
 *
 * Usage: pnpm underwrite <agentId> [--dossier] [--fresh]
 *
 *   --dossier  stop before any decision and print exactly what the judge would
 *              see. The honest way to inspect what a verdict rested on.
 *   --fresh    ignore the cache and ask again. Only useful when deliberately
 *              re-examining identical evidence.
 *
 * The pipeline is deterministic at both ends and a judgment in the middle:
 *
 *   evidence -> signals -> preflight -> cache -> judgment -> clamp -> log
 *
 * Everything except the judgment is a pure function of chain state. The
 * judgment is asked once per distinct set of facts and replayed thereafter, so
 * the same evidence always yields the same verdict even though the model that
 * produced it is not reproducible.
 *
 * Rule 7, fail closed. If the evidence is unusable or the judge is unavailable,
 * this refuses. It never substitutes a default decision, because a silent
 * fallback would be a formula wearing the underwriter's name.
 */
import 'dotenv/config';

import { gatherEvidence } from './evidence';
import { extractSignals } from './signals';
import { buildUnderwriterPrompt, UNDERWRITER_SYSTEM } from './prompt';
import { preflight, refusalVerdict, clamp } from './envelope';
import { evidenceHash, readCached, writeCached } from './cache';
import { logVerdict, reasoningHash, type LoggedVerdict } from './verdict';

function render(entry: LoggedVerdict, replayed: boolean): void {
  console.log(`Agent ${entry.agentId}\n`);
  console.log(entry.approve ? 'APPROVED' : 'REFUSED');
  console.log(`  credit limit      ${entry.credit_limit} tCTC`);
  console.log(`  collateral ratio  ${entry.collateral_ratio}`);
  console.log(`  rate              ${entry.rate_bps} bps`);
  console.log(`  confidence        ${entry.confidence}`);
  console.log(`  decided by        ${entry.source}${replayed ? ' (replayed)' : ''}`);

  console.log(`\nReasoning:\n${entry.reasoning}`);

  if (entry.adjustments.length > 0) {
    console.log(`\nEnvelope tightened the judgment:`);
    for (const a of entry.adjustments) console.log(`  - ${a}`);
  }

  console.log(`\nEvidence cited:`);
  for (const item of entry.evidence_used) console.log(`  - ${item}`);

  console.log(`\n  evidence hash   ${entry.evidenceHash}`);
  console.log(`  reasoning hash  ${entry.reasoningHash}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const agentId = Number(args[0]);
  const dossierOnly = args.includes('--dossier');
  const fresh = args.includes('--fresh');

  if (!Number.isInteger(agentId) || agentId <= 0) {
    throw new Error('usage: pnpm underwrite <agentId> [--dossier] [--fresh]');
  }

  const evidence = await gatherEvidence(agentId);
  const signals = extractSignals(evidence);

  if (dossierOnly) {
    console.log(buildUnderwriterPrompt(evidence, signals));
    return;
  }

  const hash = evidenceHash(evidence);

  // Deterministic refusals come first, so unusable evidence never costs a call.
  const gate = preflight(evidence, signals);
  if (gate.refuse) {
    const entry: LoggedVerdict = {
      ...refusalVerdict(gate, evidence),
      agentId,
      decidedAt: new Date().toISOString(),
      model: 'deterministic-envelope',
      reasoningHash: '',
      evidenceHash: hash,
      source: 'envelope',
      adjustments: [],
      evidence,
      signals,
    };
    entry.reasoningHash = reasoningHash(entry.reasoning);
    const path = logVerdict(entry);
    render(entry, false);
    console.log(`  logged to       ${path}`);
    return;
  }

  if (!fresh) {
    const cached = readCached(hash);
    if (cached) {
      render({ ...cached, source: 'cache' }, true);
      console.log(`\n  identical evidence was already judged at ${cached.decidedAt}.`);
      console.log('  Re-examine it with --fresh.');
      return;
    }
  }

  const { judge } = await import('./judge');
  const judgment = await judge(UNDERWRITER_SYSTEM, buildUnderwriterPrompt(evidence, signals));
  const held = clamp(judgment.verdict);

  const entry: LoggedVerdict = {
    ...held.verdict,
    agentId,
    decidedAt: new Date().toISOString(),
    model: judgment.model,
    reasoningHash: reasoningHash(held.verdict.reasoning),
    evidenceHash: hash,
    source: 'judgment',
    adjustments: held.adjustments,
    evidence,
    signals,
  };

  const path = logVerdict(entry);
  writeCached(hash, entry);
  render(entry, false);
  console.log(`  logged to       ${path}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
