'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CREDITCOIN } from '@assay/config/chains';

/**
 * Wallet access over EIP-1193 directly.
 *
 * No connector library: this app talks to one chain and needs connect, switch,
 * and send. A dependency that abstracts three calls would cost more than it
 * saves, and every one of them ships its own styling to fight.
 */

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

const CHAIN_ID_HEX = `0x${CREDITCOIN.chainId.toString(16)}`;

type WalletState = {
  address: string | null;
  chainId: string | null;
  available: boolean;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  send: (to: string, data: string, value?: bigint) => Promise<string>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eth = window.ethereum;
    setAvailable(Boolean(eth));
    if (!eth) return;

    void eth.request({ method: 'eth_accounts' }).then((a) => {
      const accounts = a as string[];
      if (accounts.length > 0) setAddress(accounts[0]);
    });
    void eth.request({ method: 'eth_chainId' }).then((c) => setChainId(c as string));

    const onAccounts = (...args: never[]) => setAddress((args[0] as string[])?.[0] ?? null);
    const onChain = (...args: never[]) => setChainId(args[0] as string);
    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError('No wallet found. Install a browser wallet to deposit or draw.');
      return;
    }
    setError(null);
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    setAddress(accounts[0] ?? null);
    setChainId((await eth.request({ method: 'eth_chainId' })) as string);
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch {
      // The chain is usually unknown to the wallet on first use; offer to add it.
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: 'Creditcoin CC3 Testnet',
            nativeCurrency: { name: 'Test CTC', symbol: CREDITCOIN.currency, decimals: 18 },
            rpcUrls: [CREDITCOIN.rpcUrl],
            blockExplorerUrls: [CREDITCOIN.explorerUrl],
          },
        ],
      });
    }
    setChainId((await eth.request({ method: 'eth_chainId' })) as string);
  }, []);

  const send = useCallback(
    async (to: string, data: string, value = 0n): Promise<string> => {
      const eth = window.ethereum;
      if (!eth || !address) throw new Error('connect a wallet first');
      setBusy(true);
      setError(null);
      try {
        return (await eth.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to, data, value: `0x${value.toString(16)}` }],
        })) as string;
      } catch (cause) {
        const message = (cause as { message?: string })?.message ?? String(cause);
        setError(message);
        throw cause;
      } finally {
        setBusy(false);
      }
    },
    [address]
  );

  const state = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      available,
      connect,
      switchChain,
      send,
      busy,
      error,
      clearError: () => setError(null),
    }),
    [address, chainId, available, connect, switchChain, send, busy, error]
  );

  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

export function useWrongNetwork(): boolean {
  const { chainId, address } = useWallet();
  return Boolean(address && chainId && chainId.toLowerCase() !== CHAIN_ID_HEX.toLowerCase());
}

export { CHAIN_ID_HEX };
