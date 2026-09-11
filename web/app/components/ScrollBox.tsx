'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * A list with a fixed height that scrolls inside itself.
 *
 * Used wherever a list grows without a natural bound: proven facts for an
 * agent, the simulator's log. Without it the containing card grows on every
 * addition and pushes everything below it off the screen.
 *
 * The bottom fade only appears when there is actually more to see. A permanent
 * fade over a short list looks like a rendering fault, which is the exact
 * problem the fade was added to solve.
 */
export function ScrollBox({
  children,
  maxHeight = 420,
  className,
}: {
  children: ReactNode;
  maxHeight?: number;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;

    const measure = () => setFits(el.scrollHeight <= el.clientHeight + 1);
    measure();

    // Content and width both change: a new log entry, or a window resize
    // reflowing text to a different number of lines.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className={`as-scrollbox${className ? ` ${className}` : ''}`} data-fits={fits}>
      <div
        ref={inner}
        className="as-scrollbox-inner"
        style={{ '--as-scrollbox-h': `${maxHeight}px` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
