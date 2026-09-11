import Link from 'next/link';

import { CREDITCOIN, REGISTRIES, SEPOLIA } from '@assay/config/chains';
import { DEPLOYMENTS } from '@assay/config/deployments';

/**
 * The bottom of every page.
 *
 * Pages used to end at their last window, which read as the page having been
 * cut off. This gives each one a floor: where to go next, what the system is
 * built on, and the addresses that anchor it, so the trust chain is one click
 * away from anywhere.
 */
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function Footer() {
  return (
    <footer className="as-footer">
      <div className="as-footer-inner">
        <div className="as-footer-brand">
          {/* The lockup, not the wordmark reset in a font: it is outlined at a
              specific tracking and a live setting would not match. */}
          <span className="as-footer-lockup">
            <img className="as-brand-light" src="/logo.svg" alt="Assay" width={112} height={32} />
            <img className="as-brand-dark" src="/logo-invert.svg" alt="Assay" width={112} height={32} />
          </span>
          <p className="as-footer-tag">Credit for autonomous agents, underwritten on proof.</p>
        </div>

        <nav className="as-footer-col" aria-label="Site">
          <span className="as-label">Site</span>
          <Link href="/">Home</Link>
          <Link href="/app">Agents</Link>
          <Link href="/simulator">Simulator</Link>
          <Link href="/how-it-works">How it works</Link>
        </nav>

        <div className="as-footer-col">
          <span className="as-label">Source</span>
          <a href="https://github.com/Samuel-Chuku/assay" target="_blank" rel="noreferrer">
            Repository ↗
          </a>
          <a
            href="https://github.com/Samuel-Chuku/assay/blob/main/EVIDENCE.md"
            target="_blank"
            rel="noreferrer"
          >
            Every transaction ↗
          </a>
          <a
            href="https://github.com/Samuel-Chuku/assay/blob/main/docs/attestcoin-integration.md"
            target="_blank"
            rel="noreferrer"
          >
            Attestcoin integration ↗
          </a>
        </div>

        <div className="as-footer-col">
          <span className="as-label">On chain</span>
          <a
            href={`${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.assayOracle}`}
            target="_blank"
            rel="noreferrer"
            className="as-num"
          >
            Oracle <span className="as-addr">{short(DEPLOYMENTS.assayOracle)} ↗</span>
          </a>
          <a
            href={`${CREDITCOIN.explorerUrl}/address/${DEPLOYMENTS.creditLine}`}
            target="_blank"
            rel="noreferrer"
            className="as-num"
          >
            Credit line <span className="as-addr">{short(DEPLOYMENTS.creditLine)} ↗</span>
          </a>
          <a
            href={`${SEPOLIA.explorerUrl}/address/${REGISTRIES.identity}`}
            target="_blank"
            rel="noreferrer"
            className="as-num as-proven"
          >
            Identity registry <span className="as-addr">{short(REGISTRIES.identity)} ↗</span>
          </a>
        </div>
      </div>

      <p className="as-footer-line">
        Built for BUIDL CTC 2026 Fall on the Attestcoin Protocol · AI track · Ethereum Sepolia
        and Creditcoin CC3 testnets · nothing here has run against real value.
      </p>
    </footer>
  );
}
