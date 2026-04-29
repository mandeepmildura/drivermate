import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES, STOP_NAMES } from '../../lib/cdc/stops';
import { loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import {
  expectedAlightingAt,
  expectedBoardingAt,
  groupedBoardingAt,
  ledgerSnapshot,
  nextActiveStopIndex,
  setBoardedCountAt,
} from '../../lib/cdc/tally';
import { ROUTE_THEMES } from '../../lib/cdc/theme';
import type { Passenger, RouteCode, RunState, StopCode } from '../../lib/cdc/types';
import { ManifestSummary } from './SummaryCard';

export default function RunSheet() {
  const navigate = useNavigate();
  const [state, setState] = useState<RunState | null>(() => loadRunState());
  const autoAdvancedRef = useRef(false);

  useEffect(() => {
    if (!state) {
      navigate('/cdc/manifest', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state) saveRunState(state);
  }, [state]);

  // If the run was saved at the first stop with a head count already entered
  // (either pre-fix runStates, or a Resume flow), advance to the next active
  // stop on first mount so the bus is treated as departed.
  useEffect(() => {
    if (autoAdvancedRef.current) return;
    if (!state || state.currentStopIndex !== 0) return;
    const stops = ROUTES[state.routeCode].stops;
    const firstStop = stops[0];
    const boardedAtFirst = state.passengers.filter(
      (p) => p.joinStop === firstStop && (p.status === 'boarded' || p.status === 'walkup'),
    ).length;
    if (boardedAtFirst === 0) return;
    const nextIdx = nextActiveStopIndex(state.passengers, state.routeCode, 0);
    if (nextIdx <= 0) return;
    autoAdvancedRef.current = true;
    setState((prev) => prev && {
      ...prev,
      currentStopIndex: nextIdx,
      stopArrivals: {
        ...prev.stopArrivals,
        [firstStop]: prev.stopArrivals[firstStop] ?? prev.startedAt,
      },
    });
  }, [state]);

  if (!state) return null;

  const stops = ROUTES[state.routeCode].stops;
  const currentStop = stops[state.currentStopIndex];
  const boarding = expectedBoardingAt(state.passengers, currentStop);
  const alighting = expectedAlightingAt(state.passengers, currentStop);

  function setPassenger(id: string, patch: Partial<Passenger>) {
    setState((prev) => prev && {
      ...prev,
      passengers: prev.passengers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function updatePassengers(updater: (prev: Passenger[]) => Passenger[]) {
    setState((prev) => prev && { ...prev, passengers: updater(prev.passengers) });
  }

  function addWalkUp(name: string, destination: StopCode) {
    setState((prev) => prev && {
      ...prev,
      passengers: [
        ...prev.passengers,
        {
          id: newId(),
          seat: '',
          name: name || '(walk-up)',
          joinStop: currentStop,
          leaveStop: destination,
          ticketType: 'Paper',
          priority: false,
          status: 'walkup',
        },
      ],
    });
  }

  function jumpTo(idx: number) {
    setState((prev) => prev && { ...prev, currentStopIndex: Math.max(0, Math.min(stops.length - 1, idx)) });
  }

  function nextStop() {
    if (!state) return;
    if (state.currentStopIndex >= stops.length - 1) {
      navigate('/cdc/form25');
      return;
    }
    const targetIdx = nextActiveStopIndex(state.passengers, state.routeCode, state.currentStopIndex);
    setState((prev) => {
      if (!prev) return prev;
      const nextStopCode = stops[targetIdx];
      return {
        ...prev,
        currentStopIndex: targetIdx,
        stopArrivals: { ...prev.stopArrivals, [nextStopCode]: new Date().toISOString() },
      };
    });
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <span className={`rounded px-2 py-0.5 text-base ${ROUTE_THEMES[state.routeCode].badge}`}>
              {state.routeCode}
            </span>
            run
          </h1>
          <p className="text-xs text-slate-400">{ROUTES[state.routeCode].label}</p>
        </div>
        <Link to="/cdc/manifest" className="text-sm text-blue-400 underline-offset-4 hover:underline">
          ← Manifest
        </Link>
      </header>

      <div className="sticky top-2 z-10">
        <ManifestSummary
          ledger={ledgerSnapshot(state.passengers, state.routeCode, state.currentStopIndex)}
          headCount={
            state.currentStopIndex === 0
              ? {
                  label: `Head count at ${STOP_NAMES[currentStop]}`,
                  count: state.passengers.filter(
                    (p) =>
                      p.joinStop === currentStop &&
                      (p.status === 'boarded' || p.status === 'walkup'),
                  ).length,
                  max: state.passengers.filter((p) => p.joinStop === currentStop).length,
                  onSet: (n) =>
                    updatePassengers((prev) => setBoardedCountAt(prev, currentStop, n)),
                }
              : undefined
          }
        />
      </div>

      <StopCarousel
        stops={stops}
        currentIndex={state.currentStopIndex}
        passengers={state.passengers}
        onJump={jumpTo}
      />

      <BoardingSection
        passengers={state.passengers}
        boarding={boarding}
        currentStop={currentStop}
        routeCode={state.routeCode}
        onSet={setPassenger}
        onWalkUp={addWalkUp}
        stops={stops}
      />

      <AlightingSection alighting={alighting} onSet={setPassenger} />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => jumpTo(state.currentStopIndex - 1)}
          disabled={state.currentStopIndex === 0}
          className="btn-secondary"
        >
          ← Previous
        </button>
        <button type="button" onClick={nextStop} className="btn-primary">
          {state.currentStopIndex === stops.length - 1 ? 'Finish trip' : 'Next stop →'}
        </button>
      </div>
    </main>
  );
}

function StopCarousel({
  stops,
  currentIndex,
  passengers,
  onJump,
}: {
  stops: StopCode[];
  currentIndex: number;
  passengers: Passenger[];
  onJump: (idx: number) => void;
}) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 pb-1">
      {stops.map((stop, idx) => {
        const isCurrent = idx === currentIndex;
        const isPast = idx < currentIndex;
        const pickups = passengers.filter((p) => p.joinStop === stop).length;
        const dropoffs = passengers.filter((p) => p.leaveStop === stop).length;
        const isSkippable = pickups === 0 && dropoffs === 0 && idx !== currentIndex && idx !== stops.length - 1;
        return (
          <button
            key={stop}
            type="button"
            onClick={() => onJump(idx)}
            className={`min-w-[5.5rem] shrink-0 snap-start rounded-xl px-3 py-2 text-center text-sm font-bold ${
              isCurrent
                ? 'bg-emerald-500 text-slate-900'
                : isPast
                  ? 'bg-slate-700 text-slate-400 line-through'
                  : isSkippable
                    ? 'bg-slate-800/50 text-slate-500'
                    : 'bg-slate-800 text-slate-100'
            }`}
            title={isSkippable ? 'No scheduled pickups or dropoffs — auto-skipped (tap to pull up anyway)' : undefined}
          >
            <div className="text-sm">{STOP_NAMES[stop]}</div>
            {!isCurrent && !isPast && (pickups > 0 || dropoffs > 0) && (
              <div className="mt-0.5 text-[10px] font-medium opacity-80 tabular-nums">
                +{pickups} −{dropoffs}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BoardingSection({
  passengers,
  boarding,
  currentStop,
  routeCode,
  onSet,
  onWalkUp,
  stops,
}: {
  passengers: Passenger[];
  boarding: Passenger[];
  currentStop: StopCode;
  routeCode: RouteCode;
  onSet: (id: string, patch: Partial<Passenger>) => void;
  onWalkUp: (name: string, dest: StopCode) => void;
  stops: StopCode[];
}) {
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkName, setWalkName] = useState('');
  const [walkDest, setWalkDest] = useState<StopCode>(stops[stops.length - 1]);

  function commitWalkUp() {
    onWalkUp(walkName.trim(), walkDest);
    setWalkName('');
    setWalkDest(stops[stops.length - 1]);
    setWalkOpen(false);
  }

  const boardedHere = boarding.filter(
    (p) => p.status === 'boarded' || p.status === 'walkup',
  ).length;
  const boardingGroups = groupedBoardingAt(passengers, currentStop, routeCode);
  const isFirstStop = stops[0] === currentStop;

  return (
    <section className="rounded-2xl bg-slate-800 p-3">
      <h2 className="mb-2 flex items-baseline justify-between gap-2 text-base font-bold">
        <span>Boarding at {STOP_NAMES[currentStop]}</span>
        <span className="tabular-nums text-emerald-300">
          {boardedHere}/{boarding.length}
          <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            on · booked
          </span>
        </span>
      </h2>
      {boarding.length === 0 && !isFirstStop && (
        <p className="text-sm text-slate-400">No expected boardings here.</p>
      )}

      {boarding.length > 0 && (
        isFirstStop ? (
          <details className="rounded-xl bg-slate-900 p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-300">
              Edit list (per-row tap)
            </summary>
            <div className="mt-3">{renderBoardingRows(boardingGroups, onSet)}</div>
          </details>
        ) : (
          renderBoardingRows(boardingGroups, onSet)
        )
      )}

      {walkOpen ? (
        <div className="mt-2 rounded-xl bg-slate-900 p-2">
          <input
            type="text"
            placeholder="Name (optional)"
            value={walkName}
            onChange={(e) => setWalkName(e.target.value)}
            className="mb-2 w-full rounded bg-slate-800 px-2 py-2 text-base"
          />
          <select
            value={walkDest}
            onChange={(e) => setWalkDest(e.target.value as StopCode)}
            className="mb-2 w-full rounded bg-slate-800 px-2 py-2 text-base"
          >
            {stops.map((s) => (
              <option key={s} value={s}>
                {STOP_NAMES[s]}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setWalkOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={commitWalkUp} className="btn-primary">
              Add walk-up
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setWalkOpen(true)} className="btn-secondary mt-2">
          + Walk-up
        </button>
      )}
    </section>
  );
}

function renderBoardingRows(
  groups: ReturnType<typeof groupedBoardingAt>,
  onSet: (id: string, patch: Partial<Passenger>) => void,
) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const groupOn = group.passengers.filter(
          (p) => p.status === 'boarded' || p.status === 'walkup',
        ).length;
        return (
          <div key={group.destination ?? 'all'} className="flex flex-col gap-2">
            {group.destination && (
              <div className="flex items-baseline justify-between px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <span>→ {STOP_NAMES[group.destination]}</span>
                <span className="tabular-nums text-slate-300">
                  {groupOn}/{group.passengers.length}
                </span>
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {group.passengers.map((p) => {
                const isOn = p.status === 'boarded' || p.status === 'walkup';
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSet(p.id, { status: isOn ? 'expected' : 'boarded' })}
                      aria-pressed={isOn}
                      className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                        isOn
                          ? 'bg-emerald-500 text-slate-900 active:bg-emerald-400'
                          : 'bg-slate-900 text-slate-100 active:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-black ${
                          isOn
                            ? 'bg-slate-900/15 text-slate-900'
                            : 'border-2 border-slate-600 text-transparent'
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-mono font-bold">{p.seat || '—'}</span>{' '}
                        <span className="font-bold">{p.name}</span>{' '}
                        {p.priority && <span className="text-amber-400">★</span>}
                      </span>
                      <span className={`shrink-0 text-xs ${isOn ? 'text-slate-700' : 'text-slate-400'}`}>
                        → {STOP_NAMES[p.leaveStop]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AlightingSection({
  alighting,
  onSet,
}: {
  alighting: Passenger[];
  onSet: (id: string, patch: Partial<Passenger>) => void;
}) {
  const remainingToMark = alighting.filter((p) => p.status !== 'alighted');
  const allOff = alighting.length > 0 && remainingToMark.length === 0;

  function markAllOff() {
    if (allOff) {
      // Toggle: bring everyone back to boarded so the driver can correct mistakes.
      for (const p of alighting) onSet(p.id, { status: 'boarded' });
    } else {
      for (const p of remainingToMark) onSet(p.id, { status: 'alighted' });
    }
  }

  return (
    <section className="rounded-2xl bg-slate-800 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">Alighting here ({alighting.length})</h2>
        {alighting.length > 1 && (
          <button
            type="button"
            onClick={markAllOff}
            className={`min-h-touch rounded-xl px-3 py-2 text-sm font-bold ${
              allOff ? 'bg-slate-700 text-slate-100' : 'bg-emerald-500 text-slate-900'
            }`}
          >
            {allOff ? 'Undo all off' : `✓ Mark all off (${remainingToMark.length})`}
          </button>
        )}
      </div>
      {alighting.length === 0 && <p className="text-sm text-slate-400">No expected alightings.</p>}
      <ul className="flex flex-col gap-2">
        {alighting.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl bg-slate-900 p-2">
            <div>
              <span className="font-mono font-bold">{p.seat || '—'}</span>{' '}
              <span>{p.name}</span>
            </div>
            <button
              type="button"
              onClick={() => onSet(p.id, { status: p.status === 'alighted' ? 'boarded' : 'alighted' })}
              className={`min-h-touch rounded-xl px-4 py-2 text-base font-bold ${
                p.status === 'alighted' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-100'
              }`}
            >
              {p.status === 'alighted' ? '✓ Off' : 'Mark off'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
