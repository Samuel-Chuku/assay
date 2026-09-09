import { CREDITCOIN, SEPOLIA } from '@assay/config/chains';

/**
 * A transaction hash, always with the chain it belongs to.
 *
 * The chain prefix is not decoration. A judge must never have to guess which
 * chain a link opens, and a wrong guess costs their trust — so the prefix is
 * part of the component rather than something a caller can forget.
 */
export type Chain = 'SEP' | 'CC3';

const EXPLORER: Record<Chain, string> = {
  SEP: SEPOLIA.explorerUrl,
  CC3: CREDITCOIN.explorerUrl,
};

const CHAIN_NAME: Record<Chain, string> = {
  SEP: 'Ethereum Sepolia',
  CC3: 'Creditcoin CC3',
};

/**
 * Six leading hex digits and four trailing, as the reference sets it:
 * `0x8004A8…BD9e`. That is `slice(0, 8)` because of the `0x`.
 */
export function truncate(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

export function TxLink({ chain, hash }: { chain: Chain; hash: string }) {
  return (
    <a
      className="as-txlink"
      href={`${EXPLORER[chain]}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      title={`${CHAIN_NAME[chain]} · ${hash}`}
    >
      <span className="as-txlink-chain">{chain}</span>
      <span className="as-txlink-hash as-num">{truncate(hash)}</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
