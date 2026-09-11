'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Agent } from '@/lib/agents';

/**
 * The agent list, bounded.
 *
 * Any agent can join by proving its own registration, so this list grows
 * without us doing anything. Rendering all of it would eventually push the rest
 * of the page off the screen and make finding one agent a scrolling exercise.
 *
 * The search appears only once the list is long enough to need it. A filter box
 * above six rows is clutter; above a dozen it is the only way in.
 */
const VISIBLE = 7;
const SEARCH_FROM = 7;

export function AgentList({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const searchable = agents.length >= SEARCH_FROM;

  const matched = useMemo(() => {
    const q = query.replace(/[^0-9]/g, '');
    if (!q) return agents;
    return agents.filter((a) => String(a.agentId).includes(q));
  }, [agents, query]);

  const shown = query || showAll ? matched : matched.slice(0, VISIBLE);
  const hidden = matched.length - shown.length;

  return (
    <>
      {searchable ? (
        <p className="as-agent-search">
          <label className="as-label" htmlFor="agent-search">
            Find by ID
          </label>
          <input
            id="agent-search"
            className="as-input as-num"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="10155"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="as-agent-count">
            {query ? `${matched.length} of ${agents.length}` : `${agents.length} agents`}
          </span>
        </p>
      ) : null}

      {matched.length === 0 ? (
        <p className="as-state">
          <strong>NO AGENT WITH THAT ID</strong> — every agent listed here has had its ERC-8004
          identity proven onto Creditcoin. One that has not applied yet will not appear.
        </p>
      ) : (
        <ul className="as-agent-list">
          {shown.map((agent) => (
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

      {hidden > 0 && !query ? (
        <p className="as-agent-more">
          <button type="button" className="as-reasoning-toggle" onClick={() => setShowAll(true)}>
            Show {hidden} more
          </button>
        </p>
      ) : null}

      {showAll && !query && agents.length > VISIBLE ? (
        <p className="as-agent-more">
          <button type="button" className="as-reasoning-toggle" onClick={() => setShowAll(false)}>
            Show fewer
          </button>
        </p>
      ) : null}
    </>
  );
}
