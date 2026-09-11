/**
 * Line icons, drawn to the same rules as the rest of the chrome: 2px ink
 * strokes, square caps, no fill, no gradients. They inherit `currentColor` so a
 * frozen or proven context tints them without a second variant.
 *
 * Deliberately not an icon font or emoji. Emoji render differently on every
 * platform and would be the only thing on the page that does.
 */
export type IconName =
  | 'identity'
  | 'feedback'
  | 'judge'
  | 'credit'
  | 'draw'
  | 'repay'
  | 'freeze'
  | 'wallet'
  | 'clock'
  | 'check'
  | 'cross'
  | 'chain'
  | 'start';

const PATHS: Record<IconName, React.ReactNode> = {
  // A registered identity: a token with a mark on it.
  identity: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M14 10h4M14 14h4M5.5 16.5c1-1.6 2-2.2 3.5-2.2s2.5.6 3.5 2.2" />
    </>
  ),
  // Feedback: a rating left by someone else.
  feedback: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8.5 10.5h7M8.5 13h4" />
    </>
  ),
  // The judgment: scales.
  judge: (
    <>
      <path d="M12 4v16M6 20h12M4 9h16M7 9l-3 5h6L7 9ZM17 9l-3 5h6l-3-5Z" />
    </>
  ),
  // A credit line: a bar with a limit marker.
  credit: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M15 8v8M6.5 12h5" />
    </>
  ),
  // Drawing down: value leaving.
  draw: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </>
  ),
  // Repaying: value returning.
  repay: (
    <>
      <path d="M12 20V8M7 13l5-5 5 5M4 4h16" />
    </>
  ),
  // Frozen: a locked line.
  freeze: (
    <>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  // The payment wallet.
  wallet: (
    <>
      <path d="M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 7V6a2 2 0 0 1 2-2h11" />
      <circle cx="17" cy="13.5" r="1.2" />
    </>
  ),
  // Evidence ageing.
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  check: <path d="M4.5 12.5 10 18 19.5 6.5" />,
  // Nothing has happened yet: an open ring, not a symbol of failure.
  start: <circle cx="12" cy="12" r="7" strokeDasharray="3 3" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  // Two chains, linked by a proof.
  chain: (
    <>
      <rect x="2.5" y="8.5" width="8" height="7" rx="2" />
      <rect x="13.5" y="8.5" width="8" height="7" rx="2" />
      <path d="M10.5 12h3" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="as-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
