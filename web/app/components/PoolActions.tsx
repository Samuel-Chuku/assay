'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

import { LENDING_POOL_ABI } from '@assay/config/abi';
import { DEPLOYMENTS } from '@assay/config/deployments';
import { Button } from './Button';
import { WalletBar } from './WalletBar';
import { useWallet, useWrongNetwork } from './wallet';

const iface = new ethers.Interface(LENDING_POOL_ABI as unknown as string[]);

/** Deposit and withdraw. Anyone can lend; there is no allow-list. */
export function PoolActions() {
  const { address, send, busy } = useWallet();
  const wrongNetwork = useWrongNetwork();
  const [amount, setAmount] = useState('1.0');
  const [sent, setSent] = useState<string | null>(null);

  const canAct = Boolean(address) && !wrongNetwork && !busy;

  async function deposit() {
    const data = iface.encodeFunctionData('deposit', []);
    setSent(await send(DEPLOYMENTS.lendingPool, data, ethers.parseEther(amount)));
  }

  async function withdraw() {
    const data = iface.encodeFunctionData('withdraw', [ethers.parseEther(amount)]);
    setSent(await send(DEPLOYMENTS.lendingPool, data));
  }

  return (
    <div className="as-actions">
      <WalletBar />
      <div className="as-actions-row">
        <label className="as-label" htmlFor="pool-amount">
          Amount
        </label>
        <input
          id="pool-amount"
          className="as-input as-num"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
        <span className="as-actions-pair">
          <Button onClick={() => void deposit()} disabled={!canAct}>
            DEPOSIT
          </Button>
          <Button onClick={() => void withdraw()} disabled={!canAct}>
            WITHDRAW
          </Button>
        </span>
      </div>
      {sent ? <p className="as-caption">Submitted {sent.slice(0, 10)}… — it will appear above once mined.</p> : null}
    </div>
  );
}
