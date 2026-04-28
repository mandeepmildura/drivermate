import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES, STOP_NAMES, stopCodeFromName } from '../../lib/cdc/stops';
import { loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import { expectedAlightingAt, expectedBoardingAt, totalServiceBoardings } from '../../lib/cdc/tally';
import type { Passenger, RouteCode, RunState, StopCode } from '../../lib/cdc/types';

type Props = {
  routeNumber: string;
  currentStopName: string | null | undefined;
};

function inferRouteCode(routeNumber: string): RouteCode {
  return routeNumber.toUpperCase().includes('C011') ? 'C011' : 'C012';
}

export default function VlinePanel({ routeNumber, currentStopName }: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<RunState | null>(() => loadRunState());
  const [expanded, setExpanded] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkName, setWalkName] = useState('');

  useEffect(() => {
    if (state) saveRunState(state);
  }, [state]);

  const expectedRouteCode = useMemo(() => inferRouteCode(routeNumber), [routeNumber]);
  const currentStop = useMemo(() => stopCodeFromName(currentStopName), [currentStopName]);
  const stops = ROUTES[expectedRouteCode].stops;
  const [walkDest, setWalkDest] = useState<StopCode>(stops[stops.length - 1]);

  const manifestMatches = !!state && state.routeCode === expectedRouteCode;

  // ── No matching manifest: thin nag strip, never expands. Tap to read. ──
  if (!manifestMatches) {
    const message = !state
      ? `No manifest loaded for ${expectedRouteCode}`
      : `Manifest is for ${state.routeCode}, this run is ${expectedRouteCode}`;
    return (
      <button
        type="button"
        onClick={() => navigate(`/cdc/manifest?return=/run&route=${expectedRouteCode}`)}
        className="shrink-0 w-full border-t border-amber-500/40 bg-amber-500/10 px-4 py-2 text-left text-sm text-amber-200 active:bg-amber-500/20"
      >
        <span className="font-bold">{message}</span>
        <span className="ml-2 opacity-80">— tap to read</span>
      </button>
    );
  }

  const passengers = state.passengers;
  const onBoardCount = passengers.filter(
    (p) => p.status === 'boarded' || p.status === 'walkup',
  ).length;
  const totalBoardings = totalServiceBoardings(passengers);
  const boarding = currentStop ? expectedBoardingAt(passengers, currentStop) : [];
  const alighting = currentStop ? expectedAlightingAt(passengers, currentStop) : [];
  const remainingToMark = alighting.filter((p) => p.status !== 'alighted');
  const allOff = alighting.length > 0 && remainingToMark.length === 0;

  function setPassenger(id: string, patch: Partial<Passenger>) {
    setState((prev) =>
      prev && {
        ...prev,
        passengers: prev.passengers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
    );
  }

  function addWalkUp() {
    if (!currentStop) return;
    setState((prev) =>
      prev && {
        ...prev,
        passengers: [
          ...prev.passengers,
          {
            id: newId(),
            seat: '',
            name: walkName.trim() || '(walk-up)',
            joinStop: currentStop,
            leaveStop: walkDest,
            ticketType: 'Paper',
            priority: false,
            status: 'walkup',
          },
        ],
      },
    );
    setWalkName('');
    setWalkDest(stops[stops.length - 1]);
    setWalkOpen(false);
  }

  function markAllOff() {
    if (allOff) {
      for (const p of alighting) setPassenger(p.id, { status: 'boarded' });
    } else {
      for (const p of remainingToMark) setPassenger(p.id, { status: 'alighted' });
    }
  }

  // ── Collapsed strip: one line at the bottom of the map ────────────────
  if (!expanded) {
    const stopLabel = currentStop ? STOP_NAMES[currentStop] : 'Awaiting stop…';
    const summary = currentStop
      ? `${boarding.length} boarding · ${alighting.length} alighting`
      : `${onBoardCount} on bus`;

    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="shrink-0 w-full border-t border-slate-700 bg-slate-900 px-4 py-2 text-left active:bg-slate-800"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0 truncate">
            <span className="text-xs uppercase text-slate-400">Next: </span>
            <span className="text-base font-bold text-slate-100">{stopLabel}</span>
            <span className="ml-2 text-xs text-slate-400">{summary}</span>
          </div>
          <div className="flex shrink-0 items-baseline gap-3 text-xs text-slate-400">
            <span>
              <span className="text-emerald-400 font-bold">{onBoardCount}</span> on
            </span>
            <span className="text-slate-500">tap ▴</span>
          </div>
        </div>
      </button>
    );
  }

  // ── Expanded panel: full controls. Has a close button. ────────────────
  return (
    <div className="shrink-0 max-h-[55vh] overflow-y-auto border-t border-slate-700 bg-slate-900">
      <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2">
        <div>
          <p className="text-xs uppercase text-slate-400">
            {currentStop ? STOP_NAMES[currentStop] : 'Awaiting stop…'}
          </p>
          <p className="text-2xl font-black text-emerald-400">
            {onBoardCount}
            <span className="ml-2 text-xs font-medium uppercase text-slate-400">on bus</span>
          </p>
        </div>
        <div className="flex items-baseline gap-4">
          <div className="text-right">
            <p className="text-xs uppercase text-slate-400">Boardings</p>
            <p className="text-xl font-bold text-slate-200">{totalBoardings}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close panel"
            className="rounded-lg bg-slate-700 px-3 py-1 text-sm font-bold text-slate-100 active:bg-slate-600"
          >
            ▾ Close
          </button>
        </div>
      </div>

      {currentStop && (
        <>
          <section className="px-3 py-2">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-bold">Boarding ({boarding.length})</h3>
              <button
                type="button"
                onClick={() => setWalkOpen(!walkOpen)}
                className="text-xs text-blue-300 underline"
              >
                {walkOpen ? 'Cancel' : '+ Walk-up'}
              </button>
            </div>

            {walkOpen && (
              <div className="mb-2 rounded-xl bg-slate-800 p-2">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={walkName}
                  onChange={(e) => setWalkName(e.target.value)}
                  className="mb-2 w-full rounded bg-slate-900 px-2 py-2 text-base"
                />
                <select
                  value={walkDest}
                  onChange={(e) => setWalkDest(e.target.value as StopCode)}
                  className="mb-2 w-full rounded bg-slate-900 px-2 py-2 text-base"
                >
                  {stops.map((s) => (
                    <option key={s} value={s}>
                      {STOP_NAMES[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addWalkUp}
                  className="min-h-touch w-full rounded-xl bg-emerald-500 px-3 py-2 text-base font-bold text-slate-900"
                >
                  Add walk-up
                </button>
              </div>
            )}

            {boarding.length === 0 ? (
              <p className="text-sm text-slate-500">No expected boardings here.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {boarding.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-800 p-2"
                  >
                    <div className="min-w-0 truncate text-sm">
                      <span className="font-mono font-bold">{p.seat || '—'}</span>{' '}
                      <span>{p.name}</span>{' '}
                      <span className="text-xs text-slate-400">→ {STOP_NAMES[p.leaveStop]}</span>
                      {p.priority && <span className="ml-1 text-amber-400">★</span>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPassenger(p.id, {
                            status: p.status === 'boarded' ? 'expected' : 'boarded',
                          })
                        }
                        className={`min-h-[2.5rem] rounded px-3 text-sm font-bold ${
                          p.status === 'boarded' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700'
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPassenger(p.id, {
                            status: p.status === 'noshow' ? 'expected' : 'noshow',
                          })
                        }
                        className={`min-h-[2.5rem] rounded px-3 text-sm font-bold ${
                          p.status === 'noshow' ? 'bg-red-600 text-slate-100' : 'bg-slate-700'
                        }`}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="px-3 pb-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold">Alighting ({alighting.length})</h3>
              {alighting.length > 1 && (
                <button
                  type="button"
                  onClick={markAllOff}
                  className={`min-h-[2.25rem] rounded-lg px-2 py-1 text-xs font-bold ${
                    allOff ? 'bg-slate-700 text-slate-100' : 'bg-emerald-500 text-slate-900'
                  }`}
                >
                  {allOff ? 'Undo all off' : `✓ All off (${remainingToMark.length})`}
                </button>
              )}
            </div>
            {alighting.length === 0 ? (
              <p className="text-sm text-slate-500">No expected alightings.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {alighting.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-800 p-2"
                  >
                    <div className="min-w-0 truncate text-sm">
                      <span className="font-mono font-bold">{p.seat || '—'}</span>{' '}
                      <span>{p.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPassenger(p.id, {
                          status: p.status === 'alighted' ? 'boarded' : 'alighted',
                        })
                      }
                      className={`min-h-[2.5rem] shrink-0 rounded px-3 text-sm font-bold ${
                        p.status === 'alighted' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700'
                      }`}
                    >
                      {p.status === 'alighted' ? '✓ Off' : 'Off'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
