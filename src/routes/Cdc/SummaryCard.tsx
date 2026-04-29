import { useEffect, useMemo, useState } from 'react';
import type { LedgerSnapshot } from '../../lib/cdc/tally';

type Stat = { label: string; value: number; tone: 'slate' | 'emerald' | 'amber' | 'sky' };

const TONE_TEXT: Record<Stat['tone'], string> = {
  slate: 'text-slate-100',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  sky: 'text-sky-300',
};

type HeadCountProp = {
  label: string; // e.g. "Head count at Mildura"
  count: number;
  max: number;
  onSet: (n: number) => void;
};

export type ManifestSummaryProps = {
  ledger: LedgerSnapshot;
  // Optional head-count entry. Driver does a single physical head count and
  // types the number; the ledger's "on bus" reflects it instantly.
  headCount?: HeadCountProp;
  variant?: 'full' | 'compact';
};

export function ManifestSummary({ ledger, headCount, variant = 'full' }: ManifestSummaryProps) {
  const stats: Stat[] = useMemo(
    () => [
      { label: 'Booked', value: ledger.booked, tone: 'slate' },
      { label: 'On bus', value: ledger.onBus, tone: 'emerald' },
      { label: 'No-shows', value: ledger.noShows, tone: 'amber' },
      { label: 'Walk-ups', value: ledger.walkUps, tone: 'sky' },
    ],
    [ledger],
  );

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1">
            <span className={`text-base ${TONE_TEXT[s.tone]}`}>{s.value}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-slate-800 p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
        Manifest summary
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-900 px-2 py-3 text-center">
            <p className={`text-3xl font-black tabular-nums ${TONE_TEXT[s.tone]}`}>{s.value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {s.label}
            </p>
          </div>
        ))}
      </div>
      {headCount && <HeadCountEntry {...headCount} />}
    </section>
  );
}

function HeadCountEntry({ label, count, max, onSet }: HeadCountProp) {
  const [draft, setDraft] = useState<string>(String(count));

  // Keep draft in sync if external state changes (e.g. row-level edits)
  useEffect(() => setDraft(String(count)), [count]);

  function commit(raw: string) {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setDraft(String(count));
      return;
    }
    onSet(Math.max(0, Math.min(max, n)));
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-900 p-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSet(Math.max(0, count - 1))}
          disabled={count <= 0}
          aria-label="One fewer"
          className="h-12 w-12 shrink-0 rounded-2xl bg-slate-700 text-2xl font-black text-slate-100 active:bg-slate-600 disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={draft}
          min={0}
          max={max}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
          className="h-14 w-24 rounded-2xl bg-slate-800 text-center text-3xl font-black tabular-nums text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => onSet(Math.min(max, count + 1))}
          disabled={count >= max}
          aria-label="One more"
          className="h-12 w-12 shrink-0 rounded-2xl bg-emerald-500 text-2xl font-black text-slate-900 active:bg-emerald-400 disabled:opacity-40"
        >
          +
        </button>
      </div>
      <p className="text-center text-[11px] text-slate-400 tabular-nums">
        of {max} booked · {Math.max(0, max - count)} no-show
        {max - count === 1 ? '' : 's'}
      </p>
    </div>
  );
}
