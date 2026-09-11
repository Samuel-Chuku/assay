import { ConnectButton } from './ConnectButton';
import { MenuItems } from './MenuItems';
import { ThemeToggle } from './ThemeToggle';

/**
 * The bar pinned to the top of every route.
 *
 * Three zones: menu items, the app name, and the system status. The status slot
 * is the best real estate on the page and it holds the live Creditcoin block
 * height beside the latest Sepolia height attested for chain key 1. That one
 * line proves the system is running against two chains while someone reads
 * about it, which no paragraph of copy can do. It is not a clock.
 *
 * This component renders whatever status it is handed and nothing more. Passing
 * `null` gives the honest loading treatment — hatched blocks and a blinking
 * caret — rather than a zero, because a rendered `0` would be a claim about the
 * chain that we have not verified.
 */

/**
 * How far the attestor network may fall behind the Sepolia head before the
 * bolt goes dim. From the design reference. Dim is not an error: attestation
 * deliberately lags to survive source-chain reorganisation.
 */
const ATTESTATION_GAP_LIMIT = 60;

export type ChainStatus = {
  /** Creditcoin CC3 head. */
  creditcoinHeight: number;
  /** Latest Sepolia height attested for chain key 1. */
  sepoliaAttestedHeight: number;
  /** Blocks between the Sepolia head and the attested height. */
  gapBlocks: number;
};

export type MenuItem = { label: string; href: string };

/*
 * Real routes only. Anchors used to sit in here alongside pages, which meant
 * "Pool" (/app#pool) and "Agents" (/app) were the same destination as far as
 * the active state was concerned, and both lit up at once.
 */
const DEFAULT_ITEMS: MenuItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Agents', href: '/app' },
  { label: 'Simulator', href: '/simulator' },
  { label: 'How it works', href: '/how-it-works' },
];

type MenuBarProps = {
  /** Centred label: the app name, or the current context on a detail view. */
  name?: string;
  items?: MenuItem[];
  /** `null` until the chains have actually been read. */
  status?: ChainStatus | null;
};

export function MenuBar({ name = 'ASSAY', items = DEFAULT_ITEMS, status = null }: MenuBarProps) {
  return (
    <nav className="as-menubar" aria-label="Main">
      <div className="as-menubar-items">
        <span className="as-menubar-mark" aria-hidden="true">
          ▤
        </span>
        <MenuItems items={items} />
      </div>

      <span className="as-menubar-name">{name}</span>

      <div className="as-menubar-right">
        <ChainHeights status={status} />
        <span className="as-menubar-divider" aria-hidden="true" />
        <ConnectButton />
        <ThemeToggle />
      </div>
    </nav>
  );
}

function ChainHeights({ status }: { status: ChainStatus | null }) {
  if (!status) {
    return (
      <div className="as-menubar-status" aria-live="polite" aria-label="Reading chain heights">
        <span className="as-hatch as-hatch-block as-hatch-height" aria-hidden="true" />
        <span className="as-sep" aria-hidden="true">
          ·
        </span>
        <span className="as-hatch as-hatch-block as-hatch-height" aria-hidden="true" />
        <span className="as-caret" aria-hidden="true">
          _
        </span>
      </div>
    );
  }

  const current = status.gapBlocks <= ATTESTATION_GAP_LIMIT;

  return (
    <div className="as-menubar-status as-num" aria-live="polite">
      <span>CC3 {status.creditcoinHeight}</span>
      <span className="as-sep" aria-hidden="true">
        ·
      </span>
      <span>SEP {status.sepoliaAttestedHeight}</span>
      <span
        className={current ? 'as-bolt-current' : 'as-bolt-behind'}
        title={
          current
            ? `Attestor network current, ${status.gapBlocks} blocks behind the Sepolia head`
            : `Attestor network ${status.gapBlocks} blocks behind the Sepolia head`
        }
      >
        ⌁
      </span>
    </div>
  );
}
