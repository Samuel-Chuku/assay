import type { FREEZE_REASONS } from '@/lib/agents';

const EXPLAIN: Record<(typeof FREEZE_REASONS)[number], string> = {
  NotFrozen: '',
  IdentityTransferred:
    'the ERC-8004 identity changed hands since underwriting, so the evidence no longer describes the borrower',
  PaymentWalletChanged:
    'the payment wallet changed since underwriting, so proven revenue can no longer be traced to it',
  EvidenceStale: 'the newest proof is past its freshness bound',
};

/**
 * Why a line stopped extending credit, stated in the window rather than a
 * tooltip. These are the two attacks the contract defends against, so showing
 * that the interface noticed is worth the space.
 */
export function FreezeBanner({ reason }: { reason: (typeof FREEZE_REASONS)[number] }) {
  if (reason === 'NotFrozen') return null;
  return (
    <p className="as-freeze-banner">
      <span aria-hidden="true">⚠ </span>
      <strong>{reason.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</strong> — {EXPLAIN[reason]}.
    </p>
  );
}
