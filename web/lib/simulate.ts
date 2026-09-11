/**
 * A faithful model of what Assay actually does, for the simulator.
 *
 * Every rule below is the rule the deployed system runs, not an illustration of
 * it. The envelope checks appear in the same order and with the same reason
 * strings as `underwriter/envelope.ts`; the bounds come from
 * `config/underwriting.ts`; the freeze reasons are the enum in `CreditLine.sol`.
 * If the real policy changes and this is not updated, the simulator becomes a
 * lie about the product, which is worse than not having one.
 *
 * The one thing deliberately *not* modelled faithfully is the judgment. A real
 * verdict is a model reading a dossier and it cannot run in a browser. What is
 * modelled is the shape of the judgment: which features it weighs and which way
 * they push. The simulator says so rather than implying a formula exists.
 */
import { UNDERWRITING_ENVELOPE as E } from '@assay/config/underwriting';
import type { IconName } from '@/app/components/Icon';

export type LineState = 'None' | 'Offered' | 'Active' | 'Frozen' | 'Repaid' | 'Defaulted';

export type FreezeReason = 'NotFrozen' | 'IdentityTransferred' | 'WalletChanged' | 'EvidenceStale';

export type SimState = {
  /** Identity proven onto Creditcoin at all. */
  proven: boolean;
  feedbackEntries: number;
  /** How many distinct addresses left that feedback. */
  distinctRaters: number;
  /** How many of those raters hold a proven ERC-8004 identity of their own. */
  ratersWithIdentity: number;
  /** Age of the newest proof, in days. */
  evidenceAgeDays: number;
  ownerChanges: number;
  walletChanges: number;

  line: LineState;
  freezeReason: FreezeReason;
  limit: number;
  collateralPosted: number;
  drawn: number;
  rateBps: number;
  /** The ratio the judgment demanded, carried from offer to acceptance. */
  collateralRatio: number;
  /** Counter values captured when the line was offered. */
  ownerChangesAtOffer: number;
  walletChangesAtOffer: number;
};

export type Outcome = {
  icon: IconName;
  tone: 'good' | 'bad' | 'neutral';
  title: string;
  /** One line: what just happened. */
  summary: string;
  /** Why the system decided that, in its own terms. */
  because: string;
  /** The rule or contract path that produced it. */
  rule?: string;
};

export type ActionId =
  | 'apply'
  | 'accept'
  | 'draw'
  | 'repay'
  | 'sell'
  | 'changeWallet'
  | 'age'
  | 'proveFresh';

export type Action = {
  id: ActionId;
  label: string;
  icon: IconName;
  /** The "if you do this" half, shown before it is clicked. */
  promise: string;
  available: (s: SimState) => boolean;
  /** Why it is unavailable, when it is. */
  blocked?: (s: SimState) => string | null;
};

export const PROFILES: { id: string; name: string; blurb: string; state: SimState }[] = [
  {
    id: 'established',
    name: 'Established agent',
    blurb: 'Three ratings from three different clients, two of whom hold their own registered identity.',
    state: base({ feedbackEntries: 3, distinctRaters: 3, ratersWithIdentity: 2, evidenceAgeDays: 0.2 }),
  },
  {
    id: 'selfrated',
    name: 'Self-rated agent',
    blurb: 'Five near-perfect ratings, every one from the same address, which holds no identity of its own.',
    state: base({ feedbackEntries: 5, distinctRaters: 1, ratersWithIdentity: 0, evidenceAgeDays: 0.2 }),
  },
  {
    id: 'newcomer',
    name: 'Brand-new agent',
    blurb: 'A proven identity and nothing else. Nobody has hired it yet.',
    state: base({ feedbackEntries: 0, distinctRaters: 0, ratersWithIdentity: 0, evidenceAgeDays: 0.1 }),
  },
  {
    id: 'stale',
    name: 'Dormant agent',
    blurb: 'A genuine record from several clients, but nothing proven for five days.',
    state: base({ feedbackEntries: 4, distinctRaters: 3, ratersWithIdentity: 1, evidenceAgeDays: 5 }),
  },
];

function base(over: Partial<SimState>): SimState {
  return {
    proven: true,
    feedbackEntries: 0,
    distinctRaters: 0,
    ratersWithIdentity: 0,
    evidenceAgeDays: 0.2,
    ownerChanges: 0,
    walletChanges: 0,
    line: 'None',
    freezeReason: 'NotFrozen',
    limit: 0,
    collateralPosted: 0,
    drawn: 0,
    rateBps: 0,
    collateralRatio: 0,
    ownerChangesAtOffer: 0,
    walletChangesAtOffer: 0,
    ...over,
  };
}

/* ------------------------------------------------------------------ *
 * The deterministic envelope, in the real order.
 * ------------------------------------------------------------------ */

export type Refusal = { reason: string; detail: string };

export function envelope(s: SimState): Refusal | null {
  if (!s.proven) {
    return {
      reason: 'identity-not-proven',
      detail:
        'No ERC-8004 identity has been proven onto Creditcoin for this agent, so there is nothing to underwrite.',
    };
  }
  if (s.ownerChanges > 0) {
    return {
      reason: 'identity-transferred',
      detail: `The identity has changed hands ${s.ownerChanges} time(s) since it was first proven. The record describes work done by a previous holder, so it says nothing about the current one.`,
    };
  }
  if (s.walletChanges > 0) {
    return {
      reason: 'payment-wallet-changed',
      detail: `The payment wallet has changed ${s.walletChanges} time(s). Revenue proven against the old wallet can no longer be traced to this borrower.`,
    };
  }
  if (s.evidenceAgeDays > E.maxEvidenceAgeDays) {
    return {
      reason: 'evidence-stale',
      detail: `The newest proof is ${s.evidenceAgeDays.toFixed(1)} days old, past the ${E.maxEvidenceAgeDays} day bound. Assay fails closed rather than lending against a stale picture.`,
    };
  }
  if (s.feedbackEntries < E.minFeedbackEntries) {
    return {
      reason: 'no-record',
      detail:
        'No proven feedback at all. There is no track record to read, so there is no judgment to make.',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The shape of the judgment. Not a formula that exists in the product.
 * ------------------------------------------------------------------ */

export type Judgment = {
  approve: boolean;
  limit: number;
  collateralRatio: number;
  rateBps: number;
  reasoning: string;
};

export function judge(s: SimState): Judgment {
  const breadth = s.distinctRaters;
  const standing = s.ratersWithIdentity;

  if (breadth <= 1) {
    return {
      approve: false,
      limit: 0,
      collateralRatio: 0,
      rateBps: 0,
      reasoning: `Every one of the ${s.feedbackEntries} ratings comes from a single counterparty${
        standing === 0 ? ', which holds no proven identity of its own' : ''
      }. Feedback is permissionless, so this is indistinguishable from an operator funding a second address to rate itself. A modest record from several independent counterparties would be a materially better risk, even at a lower average.`,
    };
  }

  // Breadth and standing both push terms, but neither can leave the envelope.
  const ratio = clamp(0.75 - 0.1 * breadth - 0.08 * standing, E.minCollateralRatio, 0.9);
  const rate = Math.round(clamp(2600 - 250 * breadth - 300 * standing, E.minRateBps, E.maxRateBps));
  const limit = Number(E.maxCreditLimit) * (breadth >= 3 ? 1 : 0.5);

  return {
    approve: true,
    limit,
    collateralRatio: ratio,
    rateBps: rate,
    reasoning: `${breadth} distinct counterparties, ${
      standing > 0
        ? `${standing} of which hold a proven ERC-8004 identity`
        : 'none of which hold a proven identity of their own'
    }. Breadth is what separates a track record from a relationship, and it is the reason this is priced where it is rather than refused.`,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Which freeze a draw would hit right now, if any. */
export function pendingFreeze(s: SimState): FreezeReason {
  if (s.ownerChanges > s.ownerChangesAtOffer) return 'IdentityTransferred';
  if (s.walletChanges > s.walletChangesAtOffer) return 'WalletChanged';
  if (s.evidenceAgeDays > E.maxEvidenceAgeDays) return 'EvidenceStale';
  return 'NotFrozen';
}

export const FREEZE_EXPLAIN: Record<FreezeReason, string> = {
  NotFrozen: 'Nothing has moved since this line was opened.',
  IdentityTransferred:
    'The ERC-8004 identity is an NFT and it changed hands. Whoever holds the line now is not who earned the record.',
  WalletChanged:
    'The payment wallet was swapped after underwriting, so proven revenue can no longer be traced to this borrower.',
  EvidenceStale:
    'The newest proof is past the freshness bound. Absent evidence is never treated as good evidence.',
};
