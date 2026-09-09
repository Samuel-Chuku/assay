import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Mono } from 'next/font/google';

import './tokens.css';
import './chrome.css';
import { MenuBar } from './components/MenuBar';

/**
 * Chrome: window titles, the menu bar, headings, buttons. Its slightly odd
 * letterforms are what give the system its period feel.
 */
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

/** Data: figures, addresses, reasoning, body. Everything that is not chrome. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Assay',
  description:
    'Credit for autonomous agents, underwritten on proof. Assay reads an agent’s work history from Ethereum, proves it on Creditcoin without a trusted oracle, and extends a credit line against it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${plexMono.variable}`}>
      <body>
        {/* The only ornament in the system. Flat shapes, fixed, no parallax. */}
        <div className="as-wallpaper" aria-hidden="true">
          <span />
          <span />
        </div>

        {/* Status is null until the chains are actually read. Wiring that up
            is the next step; rendering a placeholder number here would be a
            claim we have not verified. */}
        <MenuBar status={null} />

        <div className="as-desktop">{children}</div>
      </body>
    </html>
  );
}
