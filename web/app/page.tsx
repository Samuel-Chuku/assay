import { Window } from './components/Window';

/**
 * Scaffold only.
 *
 * This exists to prove the shell renders: fonts, wallpaper, menu bar, and the
 * Window primitive in both its default and frozen states. The landing page
 * described in the design reference replaces it wholesale — hero, live
 * evidence, limitations, footer — and none of that is built yet.
 */
export default function Page() {
  return (
    <main style={{ display: 'grid', gap: 'var(--as-5)', padding: 'var(--as-5)', maxWidth: '760px' }}>
      <Window title="Window">
        <p style={{ margin: 0 }}>
          Every region of content lives inside one of these. Thick ink outline, soft corners, and a
          hard shadow with no blur.
        </p>
      </Window>

      <Window title="What this cannot do" accent="frozen">
        <p style={{ margin: 0 }}>
          The frozen accent is the only case where a window’s chrome changes colour. It marks a
          frozen credit line or a refused application.
        </p>
      </Window>

      <Window title="Footer" dots={false}>
        <p style={{ margin: 0 }}>Dots are optional.</p>
      </Window>
    </main>
  );
}
