import { notFound } from 'next/navigation';

import { getActivity, type Activity } from '@/lib/activity';
import { getAgent, getAgentIds } from '@/lib/agents';
import { getProvenFacts, type ProvenFact } from '@/lib/evidence';
import { ActivityWindow } from '../../components/ActivityWindow';
import { AgentCard } from '../../components/AgentCard';
import { CreditLineWindow } from '../../components/CreditLineWindow';
import { EvidenceWindow } from '../../components/EvidenceWindow';
import { VerdictWindow } from '../../components/VerdictWindow';

export const revalidate = 60;

/**
 * Prerender the agents that exist, so a click lands on a built page.
 *
 * Rendered on demand, the first hit paid for a full oracle log scan and every
 * source-transaction reconstruction, which measured close to ten seconds. Built
 * ahead of time it is served immediately and refreshed in the background.
 * Agents proven after the build still render on demand, just more slowly.
 */
export async function generateStaticParams() {
  try {
    const ids = await getAgentIds();
    return ids.map((id) => ({ agentId: String(id) }));
  } catch {
    // A chain that will not answer at build time must not fail the build.
    return [];
  }
}

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

  const activity: Activity[] = await getActivity(agentId).catch(() => []);

  let facts: ProvenFact[] = [];
  let error: string | undefined;
  try {
    facts = await getProvenFacts(40, agentId);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <main className="as-page as-detail">
      <AgentCard agent={agent} className="as-w-identity" />
      <VerdictWindow agent={agent} className="as-w-verdict" />
      <CreditLineWindow agent={agent} className="as-w-lineinfo" />
      <ActivityWindow activity={activity} className="as-w-activity" />
      <EvidenceWindow facts={facts} error={error} className="as-w-evidence" />
    </main>
  );
}
