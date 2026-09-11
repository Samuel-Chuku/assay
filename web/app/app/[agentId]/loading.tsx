import { MenuBar } from '../../components/MenuBar';
import { SkeletonWindow } from '../../components/Skeleton';

/**
 * Shown the instant an agent row is clicked, before the server has read
 * anything. The menu bar is real so the page frame does not jump when the
 * content lands under it.
 */
export default function LoadingAgent() {
  return (
    <>
      <MenuBar name="Agent" />
      <main className="as-page as-detail">
        <SkeletonWindow title="Identity" rows={5} className="as-w-identity" />
        <SkeletonWindow title="Underwriter verdict" rows={7} className="as-w-verdict" />
        <SkeletonWindow title="Credit line" rows={6} className="as-w-lineinfo" />
      </main>
    </>
  );
}
