'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

import { CREDIT_LINE_ABI } from '@assay/config/abi';
import { DEPLOYMENTS } from '@assay/config/deployments';
import { Button } from './Button';
import { WalletBar } from './WalletBar';
import { useWallet, useWrongNetwork } from './wallet';

const iface = new ethers.Interface(CREDIT_LINE_ABI as unknown as string[]);

/**
 * Draw and repay, for the borrower.
 *
 * Both are refused with the reason stated in the window rather than a tooltip,
 * because "why can't I draw" is exactly the question the freeze rules exist to
 * answer.
 */
export function LineActions({
  agentId,
  borrower,
  state,
  frozenReason,
  owed,
}: {
  agentId: number;
  borrower: string;
  state: string;
  frozenReason: string | null;
  owed: string;
}) {
  const { address, send, busy } = useWallet();
  const wrongNetwork = useWrongNetwork();
  const [amount, setAmount] = useState('0.5');
  const [sent, setSent] = useState<string | null>(null);

  const isBorrower = Boolean(address && address.toLowerCase() === borrower.toLowerCase());
  const canAct = isBorrower && !wrongNetwork && !busy;

  async function draw() {
    const data = iface.encodeFunctionData('draw', [agentId, ethers.parseEther(amount)]);
    setSent(await send(DEPLOYMENTS.creditLine, data));
  }

  async function repay() {
    const data = iface.encodeFunctionData('repay', [agentId]);
    setSent(await send(DEPLOYMENTS.creditLine, data, ethers.parseEther(owed)));
  }

  return (
    <div className="as-actions">
      <WalletBar />

      {frozenReason ? (
        <p className="as-state">
          <strong>DRAW REFUSED</strong> — this line is frozen. A fresh underwriting decision is
          needed before it can draw again.
        </p>
      ) : null}

      {address && !isBorrower ? (
        <p className="as-caption">
          Connected as a different address. Only {borrower.slice(0, 8)}…{borrower.slice(-4)}, the
          agent&rsquo;s owner, can draw or repay this line.
        </p>
      ) : null}

      <div className="as-actions-row">
        <label className="as-label" htmlFor={`draw-${agentId}`}>
          Amount
        </label>
        <input
          id={`draw-${agentId}`}
          className="as-input as-num"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
        <Button onClick={() => void draw()} disabled={!canAct || state !== 'Active' || Boolean(frozenReason)}>
          DRAW
        </Button>
        <Button onClick={() => void repay()} disabled={!canAct || Number(owed) <= 0}>
          REPAY {owed}
        </Button>
      </div>

      {sent ? <p className="as-caption">Submitted {sent.slice(0, 10)}… — it will appear above once mined.</p> : null}
    </div>
  );
}
