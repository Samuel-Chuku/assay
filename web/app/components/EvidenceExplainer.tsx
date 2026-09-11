'use client';

import { useState } from 'react';

import type { FactKind, ProvenFact } from '@/lib/evidence';
import { CREDITCOIN, SEPOLIA } from '@assay/config/chains';
import { Modal } from './Modal';

/**
 * What a proven fact actually means, on demand.
 *
 * A row of hashes tells a reader that something was proven without telling
 * them what. This explains the specific event in front of them: what the
 * registry recorded, why it is believed, and what it changes about the
 * agent's credit. Per-kind, not a generic blurb.
 */
const MEANING: Record<
  FactKind,
  { what: string; why: string; effect: string }
> = {
  identity: {
    what: 'A new agent registered itself in the ERC-8004 Identity Registry on Ethereum. The registry minted it an NFT, and whoever holds that token is the agent.',
    why: 'Registration is the anchor for everything else. Feedback is addressed to an agent id, so without a proven identity there is nothing for a rating to be about.',
    effect: 'It makes the agent underwritable at all. On its own it earns no credit: an identity with no record is refused before the underwriter is even called.',
  },
  feedback: {
    what: 'A client left feedback about this agent in the ERC-8004 Reputation Registry, with a score and the address that wrote it.',
    why: 'Feedback is permissionless. Anyone may rate anyone, so the number matters far less than who left it and how many distinct parties did.',
    effect: 'It is the raw material of the judgment. The underwriter weighs breadth across counterparties and whether a rater holds a proven identity of its own, rather than averaging the scores.',
  },
  transfer: {
    what: 'The agent’s identity NFT changed hands on Ethereum. The token moved from one address to another.',
    why: 'This is the attack the whole freeze mechanism exists for: build a record, borrow against it, then hand the identity to someone with no history.',
    effect: 'It freezes any credit line bound to this agent. The evidence that earned the credit no longer describes whoever holds it, so the line stops extending new credit. Repayment still works.',
  },
  wallet: {
    what: 'The agent’s payment wallet was changed. The registry has no dedicated event for this: setAgentWallet writes reserved metadata and emits MetadataSet with keccak256("agentWallet") in its topics.',
    why: 'Revenue proven against the old address can no longer be traced to this borrower, so the picture underwriting relied on has quietly stopped being true.',
    effect: 'It freezes the credit line, on the same footing as an identity transfer.',
  },
};

export function EvidenceExplainer({ fact }: { fact: ProvenFact }) {
  const [open, setOpen] = useState(false);
  const m = MEANING[fact.kind];

  return (
    <>
      <button type="button" className="as-explain-button" onClick={() => setOpen(true)}>
        What does this mean?
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${fact.eventName} · agent #${fact.agentId}`}
      >
        <p className="as-modal-lede">{fact.detail}</p>

        <h3 className="as-modal-heading">What was recorded</h3>
        <p>{m.what}</p>

        <h3 className="as-modal-heading">Why it is believed</h3>
        <p>
          It was emitted by <span className="as-proven as-num">{fact.emitter}</span>, which is the{' '}
          {fact.emitterName}. That address is compiled into the oracle as a constant. Event
          signatures are public, so anyone can emit an identical event carrying invented values;
          what makes this one worth anything is that the contract which emitted it matched.
        </p>
        <p>{m.why}</p>

        <h3 className="as-modal-heading">What it changes</h3>
        <p>{m.effect}</p>

        <h3 className="as-modal-heading">Check it yourself</h3>
        <p>
          The event on Ethereum:{' '}
          <a href={`${SEPOLIA.explorerUrl}/tx/${fact.sourceTxHash}`} target="_blank" rel="noreferrer">
            {fact.sourceTxHash.slice(0, 18)}… ↗
          </a>
          <br />
          Its proof on Creditcoin:{' '}
          <a
            href={`${CREDITCOIN.explorerUrl}/tx/${fact.verificationTxHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {fact.verificationTxHash.slice(0, 18)}… ↗
          </a>
        </p>
        <p className="as-caption">
          {fact.attestationDelaySeconds === null
            ? 'The gap between the two could not be measured, so none is claimed.'
            : `The proof landed ${Math.floor(fact.attestationDelaySeconds / 60)}m${String(
                fact.attestationDelaySeconds % 60
              ).padStart(2, '0')}s after the event, measured from the two block timestamps. That is attestation waiting out the risk that Ethereum reorganises the block it just signed for.`}
        </p>
      </Modal>
    </>
  );
}
