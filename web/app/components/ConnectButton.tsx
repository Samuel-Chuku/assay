'use client';

import { CREDITCOIN } from '@assay/config/chains';
import { useWallet, useWrongNetwork } from './wallet';

/**
 * Wallet state in the menu bar.
 *
 * Compact on purpose: the bar's job is the chain heights, and a connect
 * control should sit beside them without competing. Never blue — blue means
 * proven, and a connected wallet is not a proven fact.
 */
export function ConnectButton() {
  const { address, connect, available, switchChain } = useWallet();
  const wrongNetwork = useWrongNetwork();

  if (!available) {
    return (
      <span className="as-connect as-connect-none" title="No browser wallet detected">
        NO WALLET
      </span>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        className="as-connect as-connect-wrong"
        onClick={() => void switchChain()}
        title={`Switch to Creditcoin CC3 (chain ${CREDITCOIN.chainId})`}
      >
        WRONG NETWORK
      </button>
    );
  }

  if (address) {
    return (
      <span className="as-connect as-connect-on as-num" title={address}>
        <span className="as-connect-dot" aria-hidden="true">
          ●
        </span>
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
    );
  }

  return (
    <button className="as-connect" onClick={() => void connect()}>
      CONNECT WALLET
    </button>
  );
}
