'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * A window, opened over the page.
 *
 * Built on <dialog> so the browser supplies the things that are tedious and
 * easy to get wrong: focus trapping, Escape to close, inertness of the page
 * behind, and the top layer so no z-index can cover it.
 *
 * Styled as one of the desktop's windows rather than as a generic overlay,
 * because that is what the rest of the interface is made of.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="as-modal"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, never on its
      // contents, which is what separates "outside" from "inside" here.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="as-modal-window">
        <header className="as-titlebar">
          <span className="as-titlebar-title">{title}</span>
          <span className="as-titlebar-spacer" />
          <button type="button" className="as-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="as-modal-body">{children}</div>
      </div>
    </dialog>
  );
}
