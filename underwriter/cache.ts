/**
 * Verdict cache, keyed on a hash of the evidence.
 *
 * The judgment is not reproducible, but the *system* is: identical evidence
 * returns the identical recorded verdict, byte for byte, forever. The model is
 * consulted once per distinct set of facts and never again, so a demo replays
 * exactly and a lender can check that the verdict they were shown is the verdict
 * that was made.
 *
 * The hash covers the substance of the evidence and nothing else. Read-time
 * fields are excluded on purpose: the block height at which we happened to look,
 * and the age derived from it, change on every read and would defeat the cache
 * without changing a single fact about the agent.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ethers } from 'ethers';

import type { EvidenceBundle } from './evidence';
import type { LoggedVerdict } from './verdict';

const CACHE_PATH = 'underwriter/verdicts/cache.json';

/** Stable serialisation: keys sorted at every level, so field order cannot change the hash. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

export function evidenceHash(evidence: EvidenceBundle): string {
  const substance = {
    agentId: evidence.agentId,
    proven: evidence.proven,
    owner: evidence.owner.toLowerCase(),
    currentOwner: evidence.currentOwner.toLowerCase(),
    paymentWallet: evidence.paymentWallet.toLowerCase(),
    provenAtBlock: evidence.provenAtBlock,
    lastEvidenceBlock: evidence.lastEvidenceBlock,
    ownerChanges: evidence.ownerChanges,
    walletChanges: evidence.walletChanges,
    oracle: evidence.provenance.oracle.toLowerCase(),
    feedback: [...evidence.feedback]
      .map((f) => ({
        client: f.client.toLowerCase(),
        value: f.value,
        valueDecimals: f.valueDecimals,
        feedbackIndex: f.feedbackIndex,
        tag1Hash: f.tag1Hash,
        clientHoldsProvenIdentity: f.clientHoldsProvenIdentity,
      }))
      // Sorted so the order the oracle happens to return them in cannot matter.
      .sort((a, b) => a.client.localeCompare(b.client) || a.feedbackIndex - b.feedbackIndex),
  };
  return ethers.id(canonical(substance));
}

type Cache = Record<string, LoggedVerdict>;

function load(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache;
}

export function readCached(hash: string): LoggedVerdict | null {
  return load()[hash] ?? null;
}

export function writeCached(hash: string, entry: LoggedVerdict): void {
  mkdirSync('underwriter/verdicts', { recursive: true });
  const cache = load();
  cache[hash] = entry;
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}
