/**
 * Exports the latest verdict per agent to config/verdicts.json.
 *
 * The verdict log lives outside git, and reasoning is model output that cannot
 * be re-derived from chain state — so the site has to be handed the text. What
 * keeps that honest is the hash: `reasoningHash` is bound into the on-chain
 * offer, so the browser can recompute keccak256 over the reasoning it displays
 * and prove it is the text the contract was given. Swapping the file after the
 * fact breaks the check.
 *
 *   pnpm verdicts:export
 */
import 'dotenv/config';

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { ethers } from 'ethers';

const LOG_DIR = 'underwriter/verdicts';
const OUTPUT = 'config/verdicts.json';

type LoggedVerdict = {
  agentId: number;
  approve: boolean;
  credit_limit: string;
  collateral_ratio: number;
  rate_bps: number;
  confidence: number;
  reasoning: string;
  evidence_used: string[];
  decidedAt: string;
  model: string;
  reasoningHash: string;
  source: string;
  adjustments: string[];
};

/** What the site needs. The full evidence bundle stays in the log. */
type ExportedVerdict = Omit<LoggedVerdict, 'evidence_used'> & { evidence_used: string[] };

function main(): void {
  if (!existsSync(LOG_DIR)) throw new Error(`${LOG_DIR} does not exist — run pnpm underwrite first`);

  const latest = new Map<number, ExportedVerdict>();

  for (const file of readdirSync(LOG_DIR).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const line of readFileSync(`${LOG_DIR}/${file}`, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as LoggedVerdict;

      // Later entries for the same agent supersede earlier ones.
      latest.set(entry.agentId, {
        agentId: entry.agentId,
        approve: entry.approve,
        credit_limit: entry.credit_limit,
        collateral_ratio: entry.collateral_ratio,
        rate_bps: entry.rate_bps,
        confidence: entry.confidence,
        reasoning: entry.reasoning,
        evidence_used: entry.evidence_used,
        decidedAt: entry.decidedAt,
        model: entry.model,
        reasoningHash: entry.reasoningHash,
        source: entry.source,
        adjustments: entry.adjustments ?? [],
      });
    }
  }

  const verdicts = [...latest.values()].sort((a, b) => a.agentId - b.agentId);

  // A verdict whose hash does not match its own text is unusable downstream.
  for (const v of verdicts) {
    const recomputed = ethers.id(v.reasoning);
    if (recomputed !== v.reasoningHash) {
      throw new Error(
        `agent ${v.agentId}: reasoningHash does not match its reasoning (${recomputed} vs ${v.reasoningHash})`
      );
    }
  }

  writeFileSync(OUTPUT, `${JSON.stringify(verdicts, null, 2)}\n`);

  console.log(`Wrote ${verdicts.length} verdict(s) to ${OUTPUT}`);
  for (const v of verdicts) {
    console.log(
      `  agent ${v.agentId}  ${v.approve ? 'APPROVED' : 'REFUSED'}  by ${v.source}  hash ${v.reasoningHash.slice(0, 12)}…  verified`
    );
  }
}

main();
