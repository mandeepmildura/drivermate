// Shared visual primitives for the V/Line UI. Mirrored across the run-screen
// V/Line panel and the manifest review wizard so a seat number reads the same
// in both places.

export function SeatPill({ seat, tone = 'default' }: { seat: string; tone?: 'default' | 'inverse' }) {
  const cls =
    tone === 'inverse'
      ? 'bg-slate-900/15 text-slate-900'
      : 'bg-emerald-500/20 text-emerald-300';
  return (
    <span className={`inline-flex h-7 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full px-2 font-mono text-xs font-bold ${cls}`}>
      {seat || '—'}
    </span>
  );
}

export function CountBadge({ n, tone }: { n: number; tone: 'emerald' | 'amber' }) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-300'
      : 'bg-amber-500/20 text-amber-300';
  return (
    <span
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${cls}`}
    >
      {n}
    </span>
  );
}
