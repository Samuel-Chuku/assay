/**
 * The latest verdict per agent, collected from the verdict log.
 *
 * The log lives outside git and reasoning is model output that cannot be
 * re-derived from chain state, so anything that wants to show a verdict has to
 * be handed the text. What keeps that honest is the hash: `reasoningHash` is
 * bound into the on-chain offer, so a reader can recompute keccak256 over the
 * reasoning it displays and prove it is the text the contract was given.
 *
 * `pnpm verdicts:export` writes this to a file for the committed build; the
 * watcher serves the same function's output live. One derivation, two consumers,
 * so a deployed site and the machine that formed the judgment cannot disagree.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { ethers } from 'ethers';

export const VERDICT_LOG_DIR = 'underwriter/verdicts';

export type LoggedVerdict = {
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

/** What a consumer needs. The full evidence bundle stays in the log. */
export type ExportedVerdict = LoggedVerdict;

export function collectVerdicts(logDir = VERDICT_LOG_DIR): ExportedVerdict[] {
  if (!existsSync(logDir)) {
    throw new Error(`${logDir} does not exist — run pnpm underwrite first`);
  }

  const latest = new Map<number, ExportedVerdict>();

  for (const file of readdirSync(logDir).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const line of readFileSync(`${logDir}/${file}`, 'utf8').split('\n')) {
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

  return verdicts;
}
