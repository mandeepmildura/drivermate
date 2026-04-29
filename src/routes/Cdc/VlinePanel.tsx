import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES, STOP_NAMES, stopCodeFromName } from '../../lib/cdc/stops';
import { loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import { expectedAlightingAt, expectedBoardingAt, totalServiceBoardings } from '../../lib/cdc/tally';
import type { Passenger, RouteCode, RunState, StopCode } from '../../lib/cdc/types';
import { CountBadge, SeatPill } from './ui';

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

  // ── No matching manifest: thin amber nag strip ─────────────────────────
  if (!manifestMatches) {
    const message = !state
      ? `No manifest loaded for ${expectedRouteCode}`
      : `Manifest is for ${state.routeCode}, this run is ${expectedRouteCode}`;
    return (
      <button
        type="button"
        onClick={() => navigate(`/cdc/manifest?return=/run&route=${expectedRouteCode}`)}
        className="shrink-0 w-full bg-amber-500/15 px-4 py-3 text-left text-sm text-amber-200 active:bg-amber-500/25"
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
  const boardedHere = boarding.filter(
    (p) => p.status === 'boarded' || p.status === 'walkup',
  ).length;

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

  // ── Collapsed strip ──────────────────────────────────────────────────────
  if (!expanded) {
    const stopLabel = currentStop ? STOP_NAMES[currentStop] : 'Awaiting stop…';

    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="shrink-0 w-full bg-slate-800 px-4 py-3 text-left active:bg-slate-700"
        style={{ boxShadow: 'inset 3px 0 0 0 rgb(16 185 129)' }}
        aria-label="Expand V/Line panel"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Next stop
            </p>
            <p className="truncate text-base font-bold text-slate-100">
              {stopLabel}
              {currentStop && (
                <span className="ml-2 text-xs font-medium text-slate-400">
                  ↑{boardedHere}/{boarding.length} ↓{alighting.length}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-baseline gap-3">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                On bus
              </p>
              <p className="text-xl font-black tabular-nums text-emerald-400">{onBoardCount}</p>
            </div>
            <span className="text-lg text-slate-500" aria-hidden>
              ›
            </span>
          </div>
        </div>
      </button>
    );
  }

  // ── Expanded sheet ───────────────────────────────────────────────────────
  return (
    <div className="shrink-0 max-h-[60vh] overflow-y-auto bg-slate-800">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-800 px-4 pb-3 pt-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {currentStop ? 'Current stop' : 'Awaiting stop…'}
          </p>
          <h2 className="text-2xl font-black leading-tight text-slate-100">
            {currentStop ? STOP_NAMES[currentStop] : '—'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              On bus
            </p>
            <p className="text-2xl font-black tabular-nums text-emerald-400">{onBoardCount}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Total
            </p>
            <p className="text-base font-bold text-slate-300">{totalBoardings}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close panel"
            className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-100 active:bg-slate-600"
          >
            ▾
          </button>
        </div>
      </div>

      {currentStop && (
        <>
          <section className="bg-slate-900/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-baseline gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300">
                Boarding
                <span className="text-base font-black tabular-nums text-slate-100">
                  {boardedHere}/{boarding.length}
                </span>
                <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">
                  boarded · booked
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setWalkOpen(!walkOpen)}
                className="text-xs font-bold text-blue-300 active:text-blue-200"
              >
                {walkOpen ? 'Cancel' : '+ Walk-up'}
              </button>
            </div>

            {walkOpen && (
              <div className="mb-3 rounded-xl bg-slate-800 p-3">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={walkName}
                  onChange={(e) => setWalkName(e.target.value)}
                  className="mb-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-base"
                />
                <select
                  value={walkDest}
                  onChange={(e) => setWalkDest(e.target.value as StopCode)}
                  className="mb-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-base"
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
                  className="min-h-touch w-full rounded-xl bg-emerald-500 px-3 py-2 text-base font-bold text-slate-900 active:bg-emerald-400"
                >
                  Add walk-up
                </button>
              </div>
            )}

            {boarding.length === 0 ? (
              <p className="text-sm text-slate-500">No expected boardings here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {boarding.map((p) => {
                  const isOn = p.status === 'boarded' || p.status === 'walkup';
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setPassenger(p.id, {
                            status: isOn ? 'expected' : 'boarded',
                          })
                        }
                        aria-pressed={isOn}
                        className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                          isOn
                            ? 'bg-emerald-500 text-slate-900 active:bg-emerald-400'
                            : 'bg-slate-800 text-slate-100 active:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-black ${
                            isOn ? 'bg-slate-900/15 text-slate-900' : 'border-2 border-slate-600 text-transparent'
                          }`}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <SeatPill seat={p.seat} tone={isOn ? 'inverse' : 'default'} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="font-bold">{p.name}</span>{' '}
                          <span className={`text-xs ${isOn ? 'text-slate-700' : 'text-slate-400'}`}>
                            → {STOP_NAMES[p.leaveStop]}
                          </span>
                          {p.priority && <span className="ml-1 text-amber-400">★</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="px-4 pb-4 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-300">
                Alighting <CountBadge n={alighting.length} tone="amber" />
              </h3>
              {alighting.length > 1 && (
                <button
                  type="button"
                  onClick={markAllOff}
                  className={`min-h-[2.25rem] rounded-full px-3 py-1 text-xs font-bold ${
                    allOff
                      ? 'bg-slate-700 text-slate-100 active:bg-slate-600'
                      : 'bg-emerald-500 text-slate-900 active:bg-emerald-400'
                  }`}
                >
                  {allOff ? 'Undo all' : `✓ All off (${remainingToMark.length})`}
                </button>
              )}
            </div>
            {alighting.length === 0 ? (
              <p className="text-sm text-slate-500">No expected alightings.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alighting.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/40 p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <SeatPill seat={p.seat} />
                      <span className="truncate text-sm font-bold text-slate-100">{p.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPassenger(p.id, {
                          status: p.status === 'alighted' ? 'boarded' : 'alighted',
                        })
                      }
                      className={`min-h-[2.75rem] shrink-0 rounded-lg px-4 text-sm font-bold ${
                        p.status === 'alighted'
                          ? 'bg-emerald-500 text-slate-900 active:bg-emerald-400'
                          : 'bg-slate-700 text-slate-100 active:bg-slate-600'
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
