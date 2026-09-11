'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { MenuItem } from './MenuBar';

/**
 * The nav items, as pills, with the current section marked.
 *
 * Client-side only because knowing which item is active means knowing the
 * current path, and nothing else in the bar needs the browser.
 *
 * Matching is by path prefix, so an agent detail page keeps "Agents" lit rather
 * than leaving the whole bar looking unvisited. Anchors on the landing page
 * only count when we are actually on the landing page.
 */
export function MenuItems({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    // An in-page anchor is not a section of its own; lighting it would mean two
    // pills on at once for the same destination.
    if (href.includes('#')) return false;
    if (href === '/') return pathname === '/';
    // An agent detail page is still the Agents section.
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`as-menubar-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
