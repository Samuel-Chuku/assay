import type { Activity } from '@/lib/activity';
import { CREDITCOIN } from '@assay/config/chains';
import { Icon, type IconName } from './Icon';
import { ScrollBox } from './ScrollBox';
import { Window } from './Window';

/**
 * What the agent did, in its own right.
 *
 * The point of this window is the `actor` column. An agent accepting terms,
 * drawing and repaying are its own decisions, signed with its own key, and the
 * contract gates them on nothing but `msg.sender == line.borrower`. Showing
 * that beside the one action only the underwriter may take makes the division
 * of power legible without a paragraph explaining it.
 */
const ICONS: Record<Activity['kind'], IconName> = {
  offered: 'judge',
  accepted: 'credit',
  drawn: 'draw',
  repaid: 'repay',
  frozen: 'freeze',
  closed: 'check',
};

const ACTOR_LABEL: Record<Activity['actor'], string> = {
  agent: 'the agent',
  underwriter: 'the underwriter',
  anyone: 'anyone',
};

function when(timestamp: number | null): string {
  if (timestamp === null) return '';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 90) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityWindow({
  activity,
  className,
}: {
  activity: Activity[];
  className?: string;
}) {
  return (
    <Window title="What the agent did" id="activity" className={className}>
      {activity.length === 0 ? (
        <p className="as-state">
          <strong>NOTHING YET</strong> — this agent has never been offered a line, so there is
          nothing for it to have decided.
        </p>
      ) : (
        <>
          <p className="as-evidence-intro">
            Read back out of the credit contract, newest first. Accepting, drawing and repaying are
            the agent&rsquo;s own transactions, signed with its own key.
          </p>
          <ScrollBox maxHeight={420}>
            {activity.map((a) => (
              <article key={`${a.txHash}-${a.kind}`} className={`as-activity is-${a.kind}`}>
                <span className="as-sim-chip as-activity-chip">
                  <Icon name={ICONS[a.kind]} size={22} />
                </span>
                <div className="as-activity-body">
                  <p className="as-activity-label">{a.label}</p>
                  <p className="as-activity-detail">{a.detail}</p>
                  <p className="as-activity-meta">
                    <span className={`as-activity-actor is-${a.actor}`}>
                      by {ACTOR_LABEL[a.actor]}
                    </span>
                    <a
                      href={`${CREDITCOIN.explorerUrl}/tx/${a.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.txHash.slice(0, 10)}… ↗
                    </a>
                    <span className="as-activity-when">{when(a.timestamp)}</span>
                  </p>
                </div>
              </article>
            ))}
          </ScrollBox>
        </>
      )}
    </Window>
  );
}
