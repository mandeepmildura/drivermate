import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../state/SessionProvider';
import { ROUTES, STOP_NAMES } from '../../lib/cdc/stops';
import { clearRunState, loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import { totalServiceBoardings } from '../../lib/cdc/tally';
import { form25Subject, formatForm25Email } from '../../lib/cdc/email';
import {
  REASON_LABELS,
  type ArrivalStatus,
  type Form25State,
  type ReasonCode,
  type RunState,
  type StopCode,
  type TimekeepingEntry,
} from '../../lib/cdc/types';

function upcomingFridayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const offset = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultForm(): Form25State {
  return {
    weekEnding: upcomingFridayISO(),
    backupBoardings: 0,
    arrival: 'ontime',
    lateMins: 0,
    entries: [],
  };
}

export default function Form25() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const [state, setState] = useState<RunState | null>(() => loadRunState());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state) navigate('/cdc/manifest', { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (state) saveRunState(state);
  }, [state]);

  if (!state) return null;

  const form: Form25State = state.form25 ?? defaultForm();

  function patchForm(patch: Partial<Form25State>) {
    setState((prev) => prev && { ...prev, form25: { ...form, ...patch } });
  }

  function addEntry() {
    const entry: TimekeepingEntry = {
      id: newId(),
      date: todayISO(),
      routeCode: state!.routeCode,
      minsLate: form.lateMins || 0,
      timeRecorded: nowHHMM(),
      location: ROUTES[state!.routeCode].stops[ROUTES[state!.routeCode].stops.length - 1],
      reasonCode: 3,
    };
    patchForm({ entries: [...form.entries, entry] });
  }

  function patchEntry(id: string, patch: Partial<TimekeepingEntry>) {
    patchForm({ entries: form.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function removeEntry(id: string) {
    patchForm({ entries: form.entries.filter((e) => e.id !== id) });
  }

  const stateForEmail: RunState = useMemo(() => ({ ...state, form25: form }), [state, form]);
  const emailBody = formatForm25Email(stateForEmail);
  const subject = form25Subject(stateForEmail);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  function finishTrip() {
    if (!confirm('Finish trip and clear saved state?')) return;
    clearRunState();
    // V/Line drivers can drive school runs too — drop them on the service
    // picker so they can choose what to do next instead of forcing them
    // through the school route list.
    const target = driver?.can_drive_vline ? '/services' : '/routes';
    navigate(target, { replace: true });
  }

  const totalBoardings = totalServiceBoardings(state.passengers);
  const stops = ROUTES[state.routeCode].stops;
  const mailto = `mailto:mandeep@freshoz.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  const arrivalOptions: { key: ArrivalStatus; label: string; tint: string; selected: string }[] = [
    {
      key: 'early',
      label: 'Early',
      tint: 'bg-secondary/10 text-secondary',
      selected: 'bg-secondary text-white',
    },
    {
      key: 'ontime',
      label: 'On time',
      tint: 'bg-primary/10 text-primary',
      selected: 'bg-primary text-on-primary',
    },
    {
      key: 'late',
      label: 'Late',
      tint: 'bg-red-500/10 text-red-800',
      selected: 'bg-red-600 text-white',
    },
  ];

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black">Form 25</h1>
        <Link to="/cdc/run" className="text-sm text-secondary underline-offset-4 hover:underline">
          ← Run sheet
        </Link>
      </header>

      <section className="rounded-2xl bg-surface-container p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Route</div>
            <div className="mt-0.5 text-base font-bold leading-tight">
              {ROUTES[state.routeCode].label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Boardings</div>
            <div className="text-3xl font-black tabular-nums text-primary">
              {totalBoardings}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container p-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Week ending
          </span>
          <input
            type="date"
            value={form.weekEnding}
            onChange={(e) => patchForm({ weekEnding: e.target.value })}
            className="mt-1.5 w-full rounded-lg bg-surface px-3 py-2 text-base"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Total back up boardings
          </span>
          <span className="block text-xs text-on-surface-variant">
            (passengers redirected from rail to coach)
          </span>
          <input
            type="number"
            min={0}
            value={form.backupBoardings}
            onChange={(e) =>
              patchForm({ backupBoardings: Math.max(0, Number(e.target.value) || 0) })
            }
            className="mt-1.5 w-full rounded-lg bg-surface px-3 py-2 text-base"
          />
        </label>
      </section>

      <section className="rounded-2xl bg-surface-container p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Arrival
        </div>
        <div className="grid grid-cols-3 gap-2">
          {arrivalOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => patchForm({ arrival: opt.key })}
              className={`min-h-touch rounded-xl px-3 py-2 text-base font-bold transition-colors ${
                form.arrival === opt.key ? opt.selected : opt.tint
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {form.arrival === 'late' && (
          <label className="mt-3 block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Minutes late
            </span>
            <input
              type="number"
              min={0}
              value={form.lateMins}
              onChange={(e) => patchForm({ lateMins: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1.5 w-full rounded-lg bg-surface px-3 py-2 text-base"
            />
          </label>
        )}
      </section>

      {form.arrival === 'late' && (
        <section className="rounded-2xl bg-surface-container p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Timekeeping entries
            </h2>
            <button
              type="button"
              onClick={addEntry}
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary active:bg-primary/25"
            >
              + Add
            </button>
          </div>
          {form.entries.length === 0 && (
            <p className="text-sm text-on-surface-variant">No entries yet — add one for this trip.</p>
          )}
          <ul className="flex flex-col gap-2">
            {form.entries.map((e) => (
              <li key={e.id} className="rounded-xl bg-surface p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Date
                    <input
                      type="date"
                      value={e.date}
                      onChange={(ev) => patchEntry(e.id, { date: ev.target.value })}
                      className="mt-1 w-full rounded-lg bg-surface-container px-2 py-1 text-sm font-normal normal-case tracking-normal text-on-surface"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Mins late
                    <input
                      type="number"
                      min={0}
                      value={e.minsLate}
                      onChange={(ev) =>
                        patchEntry(e.id, { minsLate: Math.max(0, Number(ev.target.value) || 0) })
                      }
                      className="mt-1 w-full rounded-lg bg-surface-container px-2 py-1 text-sm font-normal normal-case tracking-normal text-on-surface"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Time recorded
                    <input
                      type="time"
                      value={e.timeRecorded}
                      onChange={(ev) => patchEntry(e.id, { timeRecorded: ev.target.value })}
                      className="mt-1 w-full rounded-lg bg-surface-container px-2 py-1 text-sm font-normal normal-case tracking-normal text-on-surface"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Location
                    <select
                      value={e.location}
                      onChange={(ev) => patchEntry(e.id, { location: ev.target.value as StopCode })}
                      className="mt-1 w-full rounded-lg bg-surface-container px-2 py-1 text-sm font-normal normal-case tracking-normal text-on-surface"
                    >
                      {stops.map((s) => (
                        <option key={s} value={s}>
                          {STOP_NAMES[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Reason
                    <select
                      value={e.reasonCode}
                      onChange={(ev) =>
                        patchEntry(e.id, { reasonCode: Number(ev.target.value) as ReasonCode })
                      }
                      className="mt-1 w-full rounded-lg bg-surface-container px-2 py-1 text-sm font-normal normal-case tracking-normal text-on-surface"
                    >
                      {(Object.keys(REASON_LABELS) as Array<`${ReasonCode}`>).map((k) => {
                        const code = Number(k) as ReasonCode;
                        return (
                          <option key={code} value={code}>
                            {code} — {REASON_LABELS[code]}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(e.id)}
                  className="mt-2 text-xs font-bold text-red-800 active:text-red-800"
                >
                  Remove entry
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-surface-container p-4">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Email preview
        </h2>
        <pre className="overflow-x-auto whitespace-pre rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed text-on-surface">
{emailBody}
        </pre>
        <button
          type="button"
          onClick={() => void copyToClipboard()}
          className="btn-primary mt-3"
        >
          {copied ? 'Copied ✓' : 'Copy to clipboard'}
        </button>
        <a
          href={mailto}
          className="mt-2 block rounded-2xl bg-surface-container-high px-6 py-3 text-center text-base font-bold text-on-surface active:bg-surface-container-highest"
        >
          Open mail app → mandeep@freshoz.com
        </a>
      </section>

      <button
        type="button"
        onClick={finishTrip}
        className="self-center px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant active:text-on-surface-variant"
      >
        Finish trip & clear
      </button>
    </main>
  );
}
