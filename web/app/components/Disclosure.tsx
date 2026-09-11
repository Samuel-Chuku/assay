import type { ReactNode } from 'react';

/**
 * A "More" toggle, native.
 *
 * <details> rather than state and a click handler: it is keyboard operable and
 * findable by in-page search when closed, both of which a div pretending to be
 * a button is not.
 *
 * Exists so that cards in a grid stay the same height. One agent's extra note
 * used to make its card taller than its neighbours, which read as a layout
 * fault rather than as that agent having more to say.
 */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`as-disclosure${className ? ` ${className}` : ''}`}>
      <summary className="as-disclosure-summary">
        <span className="as-disclosure-caret" aria-hidden="true">
          ▸
        </span>
        {summary}
      </summary>
      <div className="as-disclosure-body">{children}</div>
    </details>
  );
}
