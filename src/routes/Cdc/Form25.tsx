import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    navigate('/cdc/manifest', { replace: true });
  }

  const totalBoardings = totalServiceBoardings(state.passengers);
  const stops = ROUTES[state.routeCode].stops;
  const mailto = `mailto:CoachPatronage@vline.com.au?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">Form 25</h1>
        <Link to="/cdc/run" className="text-sm text-blue-400 underline-offset-4 hover:underline">
          ← Run sheet
        </Link>
      </header>

      <section className="rounded-2xl bg-slate-800 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase text-slate-400">Route</div>
            <div className="text-lg font-bold">{ROUTES[state.routeCode].label}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-slate-400">Service boardings</div>
            <div className="text-3xl font-black text-emerald-400">{totalBoardings}</div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">Week ending</span>
          <input
            type="date"
            value={form.weekEnding}
            onChange={(e) => patchForm({ weekEnding: e.target.value })}
            className="mt-1 w-full rounded bg-slate-900 px-3 py-2 text-base"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-sm text-slate-300">
            Total back up boardings
            <span className="ml-1 text-xs text-slate-500">(passengers redirected from rail to coach)</span>
          </span>
          <input
            type="number"
            min={0}
            value={form.backupBoardings}
            onChange={(e) => patchForm({ backupBoardings: Math.max(0, Number(e.target.value) || 0) })}
            className="mt-1 w-full rounded bg-slate-900 px-3 py-2 text-base"
          />
        </label>
      </section>

      <section className="rounded-2xl bg-slate-800 p-3">
        <div className="mb-2 text-sm font-bold uppercase text-slate-400">Arrival</div>
        <div className="grid grid-cols-3 gap-2">
          {(['early', 'ontime', 'late'] as ArrivalStatus[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => patchForm({ arrival: opt })}
              className={`min-h-touch rounded-xl px-3 py-2 text-base font-bold ${
                form.arrival === opt
                  ? opt === 'late'
                    ? 'bg-red-600 text-white'
                    : opt === 'early'
                      ? 'bg-blue-500 text-white'
                      : 'bg-emerald-500 text-slate-900'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              {opt === 'ontime' ? 'On time' : opt === 'late' ? 'Late' : 'Early'}
            </button>
          ))}
        </div>

        {form.arrival === 'late' && (
          <label className="mt-3 block">
            <span className="text-sm text-slate-300">Minutes late</span>
            <input
              type="number"
              min={0}
              value={form.lateMins}
              onChange={(e) => patchForm({ lateMins: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1 w-full rounded bg-slate-900 px-3 py-2 text-base"
            />
          </label>
        )}
      </section>

      {form.arrival === 'late' && (
        <section className="rounded-2xl bg-slate-800 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase text-slate-400">Timekeeping entries</h2>
            <button type="button" onClick={addEntry} className="text-sm text-blue-300 underline">
              + Add
            </button>
          </div>
          {form.entries.length === 0 && (
            <p className="text-sm text-slate-400">No entries yet — add one for this trip.</p>
          )}
          <ul className="flex flex-col gap-2">
            {form.entries.map((e) => (
              <li key={e.id} className="rounded-xl bg-slate-900 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    Date
                    <input
                      type="date"
                      value={e.date}
                      onChange={(ev) => patchEntry(e.id, { date: ev.target.value })}
                      className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    Mins late
                    <input
                      type="number"
                      min={0}
                      value={e.minsLate}
                      onChange={(ev) =>
                        patchEntry(e.id, { minsLate: Math.max(0, Number(ev.target.value) || 0) })
                      }
                      className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    Time recorded
                    <input
                      type="time"
                      value={e.timeRecorded}
                      onChange={(ev) => patchEntry(e.id, { timeRecorded: ev.target.value })}
                      className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    Location
                    <select
                      value={e.location}
                      onChange={(ev) => patchEntry(e.id, { location: ev.target.value as StopCode })}
                      className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-sm"
                    >
                      {stops.map((s) => (
                        <option key={s} value={s}>
                          {s} {STOP_NAMES[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 text-xs">
                    Reason
                    <select
                      value={e.reasonCode}
                      onChange={(ev) =>
                        patchEntry(e.id, { reasonCode: Number(ev.target.value) as ReasonCode })
                      }
                      className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-sm"
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
                  className="mt-2 text-xs text-red-300 underline"
                >
                  Remove entry
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-slate-800 p-3">
        <h2 className="mb-2 text-sm font-bold uppercase text-slate-400">Email preview</h2>
        <pre className="overflow-x-auto whitespace-pre rounded bg-slate-900 p-3 font-mono text-xs text-slate-200">
{emailBody}
        </pre>
        <button type="button" onClick={() => void copyToClipboard()} className="btn-primary mt-3">
          {copied ? 'Copied ✓' : 'Copy to clipboard'}
        </button>
        <a
          href={mailto}
          className="mt-2 block rounded-2xl bg-slate-700 px-6 py-3 text-center text-base font-bold text-slate-50 active:bg-slate-600"
        >
          Open mail app → CoachPatronage@vline.com.au
        </a>
      </section>

      <button type="button" onClick={finishTrip} className="btn-secondary">
        Finish trip &amp; clear
      </button>
    </main>
  );
}
