/**
 * Underwrites one agent, from the command line.
 *
 * Usage: pnpm underwrite <agentId> [--dossier] [--fresh]
 *
 *   --dossier  stop before any decision and print exactly what the judge would
 *              see. The honest way to inspect what a verdict rested on.
 *   --fresh    ignore the cache and ask again. Only useful when deliberately
 *              re-examining identical evidence.
 *
 * The work itself lives in ./underwrite, because the watcher needs it too.
 *
 * Rule 7, fail closed. If the evidence is unusable or the judge is unavailable,
 * this refuses. It never substitutes a default decision, because a silent
 * fallback would be a formula wearing the underwriter's name.
 */
import 'dotenv/config';

import { dossier, underwrite } from './underwrite';
import type { LoggedVerdict } from './verdict';

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

  if (!Number.isInteger(agentId) || agentId <= 0) {
    throw new Error('usage: pnpm underwrite <agentId> [--dossier] [--fresh]');
  }

  if (args.includes('--dossier')) {
    console.log(await dossier(agentId));
    return;
  }

  const { entry, replayed, logPath } = await underwrite(agentId, {
    fresh: args.includes('--fresh'),
  });

  render(entry, replayed);

  if (replayed) {
    console.log(`\n  identical evidence was already judged at ${entry.decidedAt}.`);
    console.log('  Re-examine it with --fresh.');
  } else {
    console.log(`  logged to       ${logPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
