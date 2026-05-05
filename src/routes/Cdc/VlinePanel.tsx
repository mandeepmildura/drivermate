import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES, STOP_NAMES, stopCodeFromName } from '../../lib/cdc/stops';
import { loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import {
  expectedAlightingAt,
  expectedBoardingAt,
  groupedBoardingAt,
  ledgerSnapshot,
  setBoardedCountAt,
} from '../../lib/cdc/tally';
import { ROUTE_THEMES } from '../../lib/cdc/theme';
import type { Passenger, RouteCode, RunState, StopCode } from '../../lib/cdc/types';
import { ManifestSummary } from './SummaryCard';
import { CountBadge, SeatPill } from './ui';

type Props = {
  routeNumber: string;
  currentStopName: string | null | undefined;
  // Name of the stop the bus is currently halted at (8 s GPS dwell completed
  // within 50 m). When set, the panel auto-expands and filters its
  // boarding/alighting lists to this stop instead of `currentStopName` —
  // because the auto-advance has already moved currentStopName to the next
  // stop by the time the driver wants to mark passengers.
  arrivedStopName?: string | null;
};

function inferRouteCode(routeNumber: string): RouteCode {
  return routeNumber.toUpperCase().includes('C011') ? 'C011' : 'C012';
}

export default function VlinePanel({
  routeNumber,
  currentStopName,
  arrivedStopName,
}: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<RunState | null>(() => loadRunState());
  const [expanded, setExpanded] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkName, setWalkName] = useState('');

  useEffect(() => {
    if (state) saveRunState(state);
  }, [state]);

  const expectedRouteCode = useMemo(() => inferRouteCode(routeNumber), [routeNumber]);
  // Prefer the dwelled-at stop when present so passenger ops apply to where
  // the bus actually is, not the next waypoint.
  const operativeStopName = arrivedStopName ?? currentStopName;
  const currentStop = useMemo(() => stopCodeFromName(operativeStopName), [operativeStopName]);

  // Auto-expand on arrival, auto-collapse on departure. Driver can still
  // toggle manually while halted.
  useEffect(() => {
    if (arrivedStopName) setExpanded(true);
    else setExpanded(false);
  }, [arrivedStopName]);
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
        className="shrink-0 w-full bg-amber-500/15 px-4 py-3 text-left text-sm text-amber-800 active:bg-amber-500/25"
      >
        <span className="font-bold">{message}</span>
        <span className="ml-2 opacity-80">— tap to read</span>
      </button>
    );
  }

  const passengers = state.passengers;
  const boarding = currentStop ? expectedBoardingAt(passengers, currentStop) : [];
  const boardingGroups = currentStop
    ? groupedBoardingAt(passengers, currentStop, expectedRouteCode)
    : [];
  const alighting = currentStop ? expectedAlightingAt(passengers, currentStop) : [];
  const remainingToMark = alighting.filter((p) => p.status !== 'alighted');
  const allOff = alighting.length > 0 && remainingToMark.length === 0;
  const boardedHere = boarding.filter(
    (p) => p.status === 'boarded' || p.status === 'walkup',
  ).length;
  const isFirstStop = !!currentStop && ROUTES[expectedRouteCode].stops[0] === currentStop;
  const walkupsHere = boarding.filter((p) => p.status === 'walkup').length;
  const currentStopIndex = currentStop
    ? ROUTES[expectedRouteCode].stops.indexOf(currentStop)
    : 0;
  const ledger = ledgerSnapshot(passengers, expectedRouteCode, Math.max(0, currentStopIndex));

  function setBoardedTotalHere(total: number) {
    if (!currentStop) return;
    const clamped = Math.max(0, Math.min(boarding.length, total));
    const manifestBoarded = Math.max(0, clamped - walkupsHere);
    setState((prev) =>
      prev && {
        ...prev,
        passengers: setBoardedCountAt(prev.passengers, currentStop, manifestBoarded),
      },
    );
  }

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
    const theme = ROUTE_THEMES[expectedRouteCode];

    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="shrink-0 w-full bg-surface-container px-4 py-3 text-left active:bg-surface-container-high"
        style={{ boxShadow: `inset 3px 0 0 0 ${theme.edgeColor}` }}
        aria-label="Expand V/Line panel"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${theme.badge}`}>
                {expectedRouteCode}
              </span>
              Next stop
            </p>
            <span className="text-lg text-on-surface-variant" aria-hidden>
              ›
            </span>
          </div>
          <p className="truncate text-base font-bold text-on-surface">
            {stopLabel}
            {currentStop && (
              <span className="ml-2 text-xs font-medium text-on-surface-variant">
                ↑{boardedHere}/{boarding.length} ↓{alighting.length}
              </span>
            )}
          </p>
          <ManifestSummary ledger={ledger} variant="compact" />
        </div>
      </button>
    );
  }

  // ── Expanded sheet ───────────────────────────────────────────────────────
  return (
    <div className="shrink-0 max-h-[60vh] overflow-y-auto bg-surface-container">
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-surface-container px-4 pb-3 pt-3"
        style={{ boxShadow: `inset 3px 0 0 0 ${ROUTE_THEMES[expectedRouteCode].edgeColor}` }}
      >
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span className={`rounded px-1.5 py-0.5 ${ROUTE_THEMES[expectedRouteCode].badge}`}>
              {expectedRouteCode}
            </span>
            {currentStop ? 'Current stop' : 'Awaiting stop…'}
          </p>
          <h2 className="text-2xl font-black leading-tight text-on-surface">
            {currentStop ? STOP_NAMES[currentStop] : '—'}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close panel"
          className="rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-bold text-on-surface active:bg-surface-container-highest"
        >
          ▾
        </button>
      </div>

      <div className="px-4 pb-2">
        <ManifestSummary
          ledger={ledger}
          headCount={
            isFirstStop && boarding.length > 0
              ? {
                  label: `Head count at ${STOP_NAMES[currentStop!]}`,
                  count: boardedHere,
                  max: boarding.length,
                  onSet: setBoardedTotalHere,
                }
              : undefined
          }
        />
      </div>

      {currentStop && (
        <>
          <section className="bg-surface/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-baseline gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                Boarding
                <span className="text-base font-black tabular-nums text-on-surface">
                  {boardedHere}/{boarding.length}
                </span>
                <span className="text-[10px] font-medium normal-case tracking-normal text-on-surface-variant">
                  boarded · booked
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setWalkOpen(!walkOpen)}
                className="text-xs font-bold text-secondary active:text-secondary"
              >
                {walkOpen ? 'Cancel' : '+ Walk-up'}
              </button>
            </div>

            {walkOpen && (
              <div className="mb-3 rounded-xl bg-surface-container p-3">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={walkName}
                  onChange={(e) => setWalkName(e.target.value)}
                  className="mb-2 w-full rounded-lg bg-surface px-3 py-2 text-base"
                />
                <select
                  value={walkDest}
                  onChange={(e) => setWalkDest(e.target.value as StopCode)}
                  className="mb-2 w-full rounded-lg bg-surface px-3 py-2 text-base"
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
                  className="min-h-touch w-full rounded-xl bg-primary px-3 py-2 text-base font-bold text-on-primary active:bg-primary-container"
                >
                  Add walk-up
                </button>
              </div>
            )}

            {boarding.length === 0 && !isFirstStop && (
              <p className="text-sm text-on-surface-variant">No expected boardings here.</p>
            )}
            {boarding.length > 0 && (
              isFirstStop ? (
                <details className="rounded-xl bg-surface-container/40 p-3">
                  <summary className="cursor-pointer text-sm font-bold text-on-surface-variant">
                    Edit list (per-row tap)
                  </summary>
                  <div className="mt-3">{renderBoardingGroups(boardingGroups, setPassenger)}</div>
                </details>
              ) : (
                renderBoardingGroups(boardingGroups, setPassenger)
              )
            )}
          </section>

          <section className="px-4 pb-4 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-800">
                Alighting <CountBadge n={alighting.length} tone="amber" />
              </h3>
              {alighting.length > 1 && (
                <button
                  type="button"
                  onClick={markAllOff}
                  className={`min-h-[2.25rem] rounded-full px-3 py-1 text-xs font-bold ${
                    allOff
                      ? 'bg-surface-container-high text-on-surface active:bg-surface-container-highest'
                      : 'bg-primary text-on-primary active:bg-primary-container'
                  }`}
                >
                  {allOff ? 'Undo all' : `✓ All off (${remainingToMark.length})`}
                </button>
              )}
            </div>
            {alighting.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No expected alightings.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alighting.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface/40 p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <SeatPill seat={p.seat} />
                      <span className="truncate text-sm font-bold text-on-surface">{p.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Wasn't on bus = retroactive no-show. The first-stop
                          head-count entry doesn't track which specific
                          passengers boarded, so a missing alighter at this
                          stop is the first place we can resolve the gap. */}
                      <button
                        type="button"
                        onClick={() =>
                          setPassenger(p.id, {
                            status: p.status === 'noshow' ? 'boarded' : 'noshow',
                          })
                        }
                        className={`min-h-[2.75rem] rounded-lg px-3 text-xs font-bold ${
                          p.status === 'noshow'
                            ? 'bg-outline-variant text-on-primary active:bg-outline'
                            : 'bg-surface-container-high text-on-surface-variant active:bg-surface-container-highest'
                        }`}
                      >
                        {p.status === 'noshow' ? '✓ No-show' : "Wasn't on"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPassenger(p.id, {
                            status: p.status === 'alighted' ? 'boarded' : 'alighted',
                          })
                        }
                        className={`min-h-[2.75rem] rounded-lg px-4 text-sm font-bold ${
                          p.status === 'alighted'
                            ? 'bg-primary text-on-primary active:bg-primary-container'
                            : 'bg-surface-container-high text-on-surface active:bg-surface-container-highest'
                        }`}
                      >
                        {p.status === 'alighted' ? '✓ Off' : 'Off'}
                      </button>
                    </div>
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

function renderBoardingGroups(
  groups: ReturnType<typeof groupedBoardingAt>,
  setPassenger: (id: string, patch: Partial<Passenger>) => void,
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
              <div className="flex items-baseline justify-between px-1 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                <span>→ {STOP_NAMES[group.destination]}</span>
                <span className="tabular-nums text-on-surface-variant">
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
                      onClick={() =>
                        setPassenger(p.id, { status: isOn ? 'expected' : 'boarded' })
                      }
                      aria-pressed={isOn}
                      className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        isOn
                          ? 'bg-primary text-on-primary active:bg-primary-container'
                          : 'bg-surface-container text-on-surface active:bg-surface-container-high'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-black ${
                          isOn
                            ? 'bg-black/15 text-on-primary'
                            : 'border-2 border-outline-variant text-transparent'
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <SeatPill seat={p.seat} tone={isOn ? 'inverse' : 'default'} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-bold">{p.name}</span>{' '}
                        <span className={`text-xs ${isOn ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                          → {STOP_NAMES[p.leaveStop]}
                        </span>
                        {p.priority && <span className="ml-1 text-amber-700">★</span>}
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
