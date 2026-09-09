import type { ReactNode } from 'react';

/**
 * The only container in the system.
 *
 * Every region of content lives inside one of these. There are no bare cards,
 * no sections floating on the background, no full-bleed panels — the desktop
 * metaphor is the layout system, and this is the whole of it.
 *
 * Geometry is fixed by the design reference and comes from tokens.css:
 * 3px ink border, 10px radius, surface interior, hard down-right shadow with
 * no blur. A 32px title bar with a 2px underline, the title in Space Mono 700
 * caps on the left, two outlined circles on the right.
 */
export type WindowAccent = 'frozen';

type WindowProps = {
  title: string;
  children: ReactNode;
  /** The two ○ ○ circles. On by default; drop them for a plain footer window. */
  dots?: boolean;
  /**
   * The only case where a window's chrome changes colour: a frozen credit line
   * or a refused application. Border turns frozen and the title bar hatches.
   */
  accent?: WindowAccent;
  id?: string;
  className?: string;
};

export function Window({ title, children, dots = true, accent, id, className }: WindowProps) {
  const frozen = accent === 'frozen';

  return (
    <section
      id={id}
      className={['as-window', frozen ? 'as-window-frozen' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className={['as-titlebar', frozen ? 'as-hatch-frozen' : ''].filter(Boolean).join(' ')}>
        <span className="as-titlebar-title">{title}</span>
        <span className="as-titlebar-spacer" />
        {dots ? (
          <span className="as-dots" aria-hidden="true">
            <span />
            <span />
          </span>
        ) : null}
      </header>
      <div className="as-window-body">{children}</div>
    </section>
  );
}
