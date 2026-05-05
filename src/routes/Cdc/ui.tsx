// Shared visual primitives for the V/Line UI. Mirrored across the run-screen
// V/Line panel and the manifest review wizard so a seat number reads the same
// in both places.

export function SeatPill({ seat, tone = 'default' }: { seat: string; tone?: 'default' | 'inverse' }) {
  const cls =
    tone === 'inverse'
      ? 'bg-black/15 text-on-primary'
      : 'bg-primary/20 text-primary';
  return (
    <span className={`inline-flex h-7 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full px-2 font-mono text-xs font-bold ${cls}`}>
      {seat || '—'}
    </span>
  );
}

export function CountBadge({ n, tone }: { n: number; tone: 'emerald' | 'amber' }) {
  const cls =
    tone === 'emerald'
      ? 'bg-primary/20 text-primary'
      : 'bg-amber-500/20 text-amber-800';
  return (
    <span
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${cls}`}
    >
      {n}
    </span>
  );
}
