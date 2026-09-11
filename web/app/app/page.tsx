import Link from 'next/link';

import { getAgents, getPool } from '@/lib/agents';
import { AgentCard } from '../components/AgentCard';
import { AgentList } from '../components/AgentList';
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
    <main className="as-page as-detail">
      <Window title="Agents" id="agents" className="as-w-verdict">
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
          <AgentList agents={agents} />
        )}
      </Window>

      {pool ? <PoolWindow pool={pool} className="as-w-identity" /> : null}

      {agents[0] ? <AgentCard agent={agents[0]} id="latest" className="as-w-lineinfo" /> : null}
    </main>
  );
}
