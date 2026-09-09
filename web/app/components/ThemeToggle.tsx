'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Day or night on the same desk.
 *
 * The choice is written to the root element and to localStorage; a small
 * inline script in the document head applies it before first paint, so the
 * page never flashes the wrong palette. With no stored choice, the system
 * preference decides and this button just reports it.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('assay-theme') as Theme | null;
    const system: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    setTheme(stored ?? system);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('assay-theme', next);
  }

  return (
    <button
      className="as-theme-toggle"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to day' : 'Switch to night'}
      aria-label={theme === 'dark' ? 'Switch to day' : 'Switch to night'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
