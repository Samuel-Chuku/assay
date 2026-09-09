/**
 * Underwriting one agent, as a function.
 *
 * The CLI and the watcher both need this, and a long-running process should not
 * be shelling out to its own CLI to get a verdict.
 *
 * The pipeline is deterministic at both ends with a judgment in the middle:
 *
 *   evidence -> signals -> preflight -> cache -> judgment -> clamp -> log
 *
 * Everything except the judgment is a pure function of chain state, so the same
 * facts always produce the same verdict even though the model is not
 * reproducible.
 */
import { gatherEvidence } from './evidence';
import { extractSignals } from './signals';
import { buildUnderwriterPrompt, UNDERWRITER_SYSTEM } from './prompt';
import { preflight, refusalVerdict, clamp } from './envelope';
import { evidenceHash, readCached, writeCached } from './cache';
import { LLM_MODEL } from '../config/underwriting';
import { logVerdict, reasoningHash, type LoggedVerdict } from './verdict';

export type UnderwriteResult = {
  entry: LoggedVerdict;
  /** Replayed from cache, so no model call was made and nothing changed. */
  replayed: boolean;
  /** Where the verdict was appended, absent on a replay. */
  logPath?: string;
};

export async function underwrite(
  agentId: number,
  options: { fresh?: boolean } = {}
): Promise<UnderwriteResult> {
  const evidence = await gatherEvidence(agentId);
  const signals = extractSignals(evidence);
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
    return { entry, replayed: false, logPath: logVerdict(entry) };
  }

  if (!options.fresh) {
    const cached = readCached(hash, LLM_MODEL);
    if (cached) return { entry: { ...cached, source: 'cache' }, replayed: true };
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

  const logPath = logVerdict(entry);
  writeCached(hash, judgment.model, entry);
  return { entry, replayed: false, logPath };
}

/** The dossier the judge would see, without asking for a decision. */
export async function dossier(agentId: number): Promise<string> {
  const evidence = await gatherEvidence(agentId);
  return buildUnderwriterPrompt(evidence, extractSignals(evidence));
}
