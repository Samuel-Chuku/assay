import type { Agent } from '@/lib/agents';
import { truncate } from './TxLink';
import { Window } from './Window';

/**
 * Identity, as proven from the Sepolia registry.
 *
 * Almost everything here came through Attestcoin, so almost everything is blue.
 * The two warning banners are the freeze triggers the contract defends against
 * — an identity that changed hands, or a payment wallet that was swapped after
 * underwriting.
 */
export function AgentCard({ agent, id = 'agents', className }: { agent: Agent; id?: string; className?: string }) {
  const transferred = agent.ownerChanges > 0;
  const walletChanged = agent.walletChanges > 0;

  return (
    <Window title={`Agent #${agent.agentId}`} id={id} accent={transferred || walletChanged ? 'frozen' : undefined} className={className}>
      {transferred ? (
        <p className="as-freeze-banner">
          <span aria-hidden="true">⚠ </span>
          <strong>OWNERSHIP CHANGED</strong> — this identity has changed hands {agent.ownerChanges}{' '}
          time(s) since it was first proven.
        </p>
      ) : null}
      {walletChanged ? (
        <p className="as-freeze-banner">
          <span aria-hidden="true">⚠ </span>
          <strong>WALLET CHANGED</strong> — the payment wallet has changed {agent.walletChanges}{' '}
          time(s).
        </p>
      ) : null}

      <dl className="as-fields">
        <dt className="as-label">Owner</dt>
        <dd className="as-proven as-num" title={agent.currentOwner}>
          {truncate(agent.currentOwner)}
        </dd>

        <dt className="as-label">Payment wallet</dt>
        <dd className={agent.paymentWallet === ZERO ? '' : 'as-proven as-num'}>
          {agent.paymentWallet === ZERO ? 'not set' : truncate(agent.paymentWallet)}
        </dd>

        <dt className="as-label">Feedback</dt>
        <dd className="as-proven as-num">{agent.feedbackCount} entries</dd>

        <dt className="as-label">Identity transfers</dt>
        <dd className="as-proven as-num">{agent.ownerChanges}</dd>

        <dt className="as-label">Wallet changes</dt>
        <dd className="as-proven as-num">{agent.walletChanges}</dd>
      </dl>
    </Window>
  );
}

const ZERO = '0x0000000000000000000000000000000000000000';
