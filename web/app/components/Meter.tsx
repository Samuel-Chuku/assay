/**
 * The system-widget meter from the reference, repurposed.
 *
 * Three uses, three fills. `attestation` is the only one that gets proof blue,
 * because it reports something the attestor network actually established.
 */
export type MeterKind = 'attestation' | 'utilisation' | 'drawn';

export function Meter({
  label,
  kind,
  fraction,
  value,
}: {
  label: string;
  kind: MeterKind;
  /** 0 to 1. Clamped, because a bar wider than its track reads as a bug. */
  fraction: number;
  value: string;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;

  return (
    <div className="as-meter">
      <span className="as-label as-meter-label">{label}</span>
      <span className="as-meter-track" role="img" aria-label={`${label}: ${value}`}>
        <span className={`as-meter-fill as-meter-${kind}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="as-meter-value as-num">{value}</span>
    </div>
  );
}
