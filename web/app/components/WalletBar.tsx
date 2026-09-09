'use client';

import { CREDITCOIN } from '@assay/config/chains';
import { Button } from './Button';
import { useWallet, useWrongNetwork } from './wallet';

/** Connect state and the wrong-network banner, shared by every action window. */
export function WalletBar() {
  const { address, connect, available, error, clearError } = useWallet();
  const wrongNetwork = useWrongNetwork();
  const { switchChain } = useWallet();

  if (!available) {
    return (
      <p className="as-state">
        <strong>NO WALLET FOUND</strong> — install a browser wallet to deposit, draw, or repay.
        Everything else on this page works without one.
      </p>
    );
  }

  return (
    <div className="as-walletbar">
      {address ? (
        <span className="as-num as-walletbar-address">
          {address.slice(0, 8)}…{address.slice(-4)}
        </span>
      ) : (
        <Button onClick={() => void connect()}>CONNECT WALLET</Button>
      )}

      {wrongNetwork ? (
        <p className="as-freeze-banner">
          <span aria-hidden="true">⚠ </span>
          <strong>WRONG NETWORK</strong> — connect to Creditcoin CC3 Testnet (chain{' '}
          {CREDITCOIN.chainId}). <Button onClick={() => void switchChain()}>SWITCH NETWORK</Button>
        </p>
      ) : null}

      {error ? (
        <p className="as-state as-error" onClick={clearError}>
          <strong>TRANSACTION REFUSED</strong> — {error.slice(0, 180)}
        </p>
      ) : null}
    </div>
  );
}
