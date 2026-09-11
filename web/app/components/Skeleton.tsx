import { Window } from './Window';

/**
 * What a window looks like before its chain reads have returned.
 *
 * Every page here renders from two chains, so a click on an agent is a round
 * trip and not a local state change. Without this the browser sits on the old
 * page with nothing happening, which reads as a broken link rather than as
 * work in progress.
 *
 * The bars are hatched rather than pulsing grey: the same treatment the menu
 * bar already uses for a block height it has not read yet. A shimmer would
 * imply content is arriving imminently, which on a ten-second chain read is a
 * promise the page cannot keep.
 */
export function SkeletonLines({ rows = 4 }: { rows?: number }) {
  // Deterministic widths: a random spread re-renders differently on the server
  // and the client, and React would call that a hydration mismatch.
  const widths = [92, 74, 85, 61, 80, 68, 88, 55];

  return (
    <div className="as-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className="as-hatch-block as-skeleton-bar"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonWindow({
  title,
  rows = 4,
  className,
}: {
  title: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Window title={title} className={className}>
      <p className="as-state">
        <span className="as-caret">▍</span> reading both chains…
      </p>
      <SkeletonLines rows={rows} />
    </Window>
  );
}
