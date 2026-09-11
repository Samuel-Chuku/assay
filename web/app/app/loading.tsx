import { MenuBar } from '../components/MenuBar';
import { SkeletonWindow } from '../components/Skeleton';

export default function LoadingApp() {
  return (
    <>
      <MenuBar />
      <main className="as-page as-detail">
        <SkeletonWindow title="Agents" rows={6} className="as-w-verdict" />
        <SkeletonWindow title="Lending pool" rows={5} className="as-w-identity" />
      </main>
    </>
  );
}
