import type { Pool } from '@/lib/agents';
import { Meter } from './Meter';
import { PoolActions } from './PoolActions';
import { Window } from './Window';

/**
 * The lender side. Plain on purpose: this window exists to show there is a real
 * two-sided market rather than a faucet, so correctness matters more than
 * presentation.
 */
export function PoolWindow({ pool, id = 'pool' }: { pool: Pool; id?: string }) {
  return (
    <Window title="Lending pool" id={id}>
      <dl className="as-fields">
        <dt className="as-label">Total deposited</dt>
        <dd className="as-num">{pool.totalAssets} tCTC</dd>

        <dt className="as-label">Out on loan</dt>
        <dd className="as-num">{pool.totalDeployed} tCTC</dd>

        <dt className="as-label">Liquid</dt>
        <dd className="as-num">{pool.liquid} tCTC</dd>
      </dl>

      <Meter
        label="utilisation"
        kind="utilisation"
        fraction={pool.utilisation}
        value={`${Math.round(pool.utilisation * 100)}%`}
      />

      <PoolActions />
    </Window>
  );
}
