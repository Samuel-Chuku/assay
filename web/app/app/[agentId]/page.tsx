import { notFound } from 'next/navigation';

import { getAgent } from '@/lib/agents';
import { getProvenFacts, type ProvenFact } from '@/lib/evidence';
import { AgentCard } from '../../components/AgentCard';
import { CreditLineWindow } from '../../components/CreditLineWindow';
import { EvidenceWindow } from '../../components/EvidenceWindow';
import { VerdictWindow } from '../../components/VerdictWindow';

export const revalidate = 60;

/**
 * One agent, end to end: the identity that was proven, the facts it rests on,
 * the judgment formed from them, and the line that judgment produced.
 */
export default async function AgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId: raw } = await params;
  const agentId = Number(raw);
  if (!Number.isInteger(agentId)) notFound();

  const agent = await getAgent(agentId).catch(() => null);
  if (!agent) notFound();

  let facts: ProvenFact[] = [];
  let error: string | undefined;
  try {
    facts = (await getProvenFacts(40)).filter((f) => f.agentId === agentId);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <main className="as-page as-detail">
      <AgentCard agent={agent} className="as-w-identity" />
      <VerdictWindow agent={agent} className="as-w-verdict" />
      <CreditLineWindow agent={agent} className="as-w-lineinfo" />
      <EvidenceWindow facts={facts} error={error} className="as-w-evidence" />
    </main>
  );
}
