import Link from 'next/link';

import { getAgents, getPool } from '@/lib/agents';
import { AgentCard } from '../components/AgentCard';
import { PoolWindow } from '../components/PoolWindow';
import { Window } from '../components/Window';

export const revalidate = 60;

/** The dashboard: every proven agent, and the pool that funds them. */
export default async function AppPage() {
  const [agents, pool] = await Promise.all([
    getAgents().catch(() => []),
    getPool().catch(() => null),
  ]);

  return (
    <main className="as-page">
      <Window title="Agents" id="agents">
        <p className="as-evidence-intro">
          Every agent whose ERC-8004 identity has been proven onto Creditcoin. The verdict column is
          the underwriter&rsquo;s judgment on that proven history.
        </p>
        {agents.length === 0 ? (
          <p className="as-state">
            <strong>NO AGENTS YET</strong> — an identity appears here once its ERC-8004 registration
            has been attested on Sepolia and verified on Creditcoin.
          </p>
        ) : (
          <ul className="as-agent-list">
            {agents.map((agent) => (
              <li key={agent.agentId}>
                <Link href={`/app/${agent.agentId}`} className="as-agent-row">
                  <span className="as-agent-id">#{agent.agentId}</span>
                  <span className="as-agent-verdict">
                    {agent.verdict
                      ? agent.verdict.approve
                        ? 'APPROVED'
                        : 'DECLINED'
                      : 'not underwritten'}
                  </span>
                  <span className="as-agent-line">
                    {agent.line ? agent.line.state.toUpperCase() : 'no line'}
                  </span>
                  <span className="as-proven as-num">{agent.feedbackCount} facts</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Window>

      {pool ? <PoolWindow pool={pool} /> : null}

      {agents[0] ? <AgentCard agent={agents[0]} id="latest" /> : null}
    </main>
  );
}
