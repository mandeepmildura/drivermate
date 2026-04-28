import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES, STOP_NAMES } from '../../lib/cdc/stops';
import { loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import { expectedAlightingAt, expectedBoardingAt, onBoardAfter } from '../../lib/cdc/tally';
import type { Passenger, RunState, StopCode } from '../../lib/cdc/types';

export default function RunSheet() {
  const navigate = useNavigate();
  const [state, setState] = useState<RunState | null>(() => loadRunState());

  useEffect(() => {
    if (!state) {
      navigate('/cdc/manifest', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state) saveRunState(state);
  }, [state]);

  if (!state) return null;

  const stops = ROUTES[state.routeCode].stops;
  const currentStop = stops[state.currentStopIndex];
  const onBoard = onBoardAfter(state.passengers, state.routeCode, state.currentStopIndex);
  const boarding = expectedBoardingAt(state.passengers, currentStop);
  const alighting = expectedAlightingAt(state.passengers, currentStop);

  function setPassenger(id: string, patch: Partial<Passenger>) {
    setState((prev) => prev && {
      ...prev,
      passengers: prev.passengers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
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
    setState((prev) => {
      if (!prev) return prev;
      const idx = prev.currentStopIndex + 1;
      const nextStopCode = stops[idx];
      return {
        ...prev,
        currentStopIndex: idx,
        stopArrivals: { ...prev.stopArrivals, [nextStopCode]: new Date().toISOString() },
      };
    });
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-black">{state.routeCode} run</h1>
          <p className="text-xs text-slate-400">{ROUTES[state.routeCode].label}</p>
        </div>
        <Link to="/cdc/manifest" className="text-sm text-blue-400 underline-offset-4 hover:underline">
          ← Manifest
        </Link>
      </header>

      <StopCarousel
        stops={stops}
        currentIndex={state.currentStopIndex}
        onJump={jumpTo}
      />

      <div className="rounded-2xl bg-slate-800 p-3 text-center">
        <div className="text-xs uppercase text-slate-400">On board after {currentStop}</div>
        <div className="text-counter text-emerald-400">{onBoard}</div>
      </div>

      <BoardingSection
        boarding={boarding}
        currentStop={currentStop}
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
  onJump,
}: {
  stops: StopCode[];
  currentIndex: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 pb-1">
      {stops.map((stop, idx) => {
        const isCurrent = idx === currentIndex;
        const isPast = idx < currentIndex;
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
                  : 'bg-slate-800 text-slate-100'
            }`}
          >
            <div className="font-mono">{stop}</div>
            <div className="text-[10px] font-medium opacity-80">{STOP_NAMES[stop]}</div>
          </button>
        );
      })}
    </div>
  );
}

function BoardingSection({
  boarding,
  currentStop,
  onSet,
  onWalkUp,
  stops,
}: {
  boarding: Passenger[];
  currentStop: StopCode;
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

  return (
    <section className="rounded-2xl bg-slate-800 p-3">
      <h2 className="mb-2 text-base font-bold">Boarding at {currentStop} ({boarding.length})</h2>
      {boarding.length === 0 && <p className="text-sm text-slate-400">No expected boardings here.</p>}
      <ul className="flex flex-col gap-2">
        {boarding.map((p) => (
          <li key={p.id} className="rounded-xl bg-slate-900 p-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-mono font-bold">{p.seat || '—'}</span>{' '}
                <span>{p.name}</span>{' '}
                {p.priority && <span className="text-amber-400">★</span>}
              </div>
              <div className="text-xs text-slate-400">
                → {p.leaveStop} · {p.ticketType === 'eTicket' ? 'e' : 'P'}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSet(p.id, { status: p.status === 'boarded' ? 'expected' : 'boarded' })}
                className={`min-h-touch rounded-xl px-3 py-2 text-lg font-bold ${
                  p.status === 'boarded' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-100'
                }`}
              >
                ✓ Boarded
              </button>
              <button
                type="button"
                onClick={() => onSet(p.id, { status: p.status === 'noshow' ? 'expected' : 'noshow' })}
                className={`min-h-touch rounded-xl px-3 py-2 text-lg font-bold ${
                  p.status === 'noshow' ? 'bg-red-600 text-slate-100' : 'bg-slate-700 text-slate-100'
                }`}
              >
                ✕ No-show
              </button>
            </div>
          </li>
        ))}
      </ul>

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
                {s} {STOP_NAMES[s]}
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
