import { UNDERWRITING_ENVELOPE as E } from '@assay/config/underwriting';
import { Icon } from '../components/Icon';
import { Simulator } from '../components/Simulator';
import { Window } from '../components/Window';

export const metadata = {
  title: 'Simulator · Assay',
  description:
    'Try the attacks the contracts were written to stop, and watch them stop. Every rule here is the rule the deployed system runs.',
};

const RULES = [
  {
    icon: 'identity' as const,
    name: 'Identity transferred',
    fires: 'The ERC-8004 token changes hands after a line is opened.',
    then: 'The line freezes. New credit stops; repayment still works.',
  },
  {
    icon: 'wallet' as const,
    name: 'Payment wallet changed',
    fires: 'setAgentWallet points revenue at a new address.',
    then: 'The line freezes. Proven revenue can no longer be traced to the borrower.',
  },
  {
    icon: 'clock' as const,
    name: 'Evidence stale',
    fires: `Nothing new has been proven for ${E.maxEvidenceAgeDays} days.`,
    then: 'The line freezes. Absent evidence is never treated as good evidence.',
  },
  {
    icon: 'feedback' as const,
    name: 'No record',
    fires: 'The agent has no proven feedback at all.',
    then: 'Refused before any model runs. There is nothing to judge.',
  },
];

export default function SimulatorPage() {
  return (
    <main className="as-page">
      <Window title="Simulator">
        <h1 className="as-hero-headline">Try to break it.</h1>
        <p className="as-hero-body">
          Assay lends against an agent&rsquo;s proven work history. The interesting question is not
          what happens when everything goes right, it is what happens when someone builds a record,
          borrows against it, and then sells the identity.
        </p>
        <p className="as-hero-body">
          Every rule below is the rule the deployed system runs, with the same order and the same
          reason strings. Nothing here needs a wallet, and nothing here spends anything.
        </p>
      </Window>

      <Simulator />

      <Window title="The rules, in full">
        <div className="as-rule-grid">
          {RULES.map((r) => (
            <div key={r.name} className="as-rule">
              <span className="as-rule-icon">
                <Icon name={r.icon} size={26} />
              </span>
              <p className="as-rule-name">{r.name}</p>
              <p className="as-rule-when">
                <span className="as-label">If</span> {r.fires}
              </p>
              <p className="as-rule-then">
                <span className="as-label">Then</span> {r.then}
              </p>
            </div>
          ))}
        </div>
        <p className="as-caption">
          The judgment itself is not simulated. A real verdict is a model reading a dossier of proven
          facts, and it cannot run in your browser. What the simulator models is the shape of that
          judgment: breadth of counterparties and the standing of whoever left the feedback. The
          deterministic parts, the envelope and the freeze triggers, are exact.
        </p>
      </Window>
    </main>
  );
}
