import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { RouteStopRow } from '../lib/db';
import { loadRouteStops } from '../lib/routes';
import { setSimulatedPosition } from '../lib/simulator';
import { haversineMetres } from '../lib/geo';
import { hasPassedWaypoint } from '../lib/turfUtils';
import {
  ARRIVED_DISTANCE_M,
  ARRIVAL_DWELL_MS_STOP,
  AUDIO_TRIGGER_M,
} from '../lib/runConfig';

interface ShiftSummary {
  id: string;
  driver_id: string;
  route_id: string;
  started_at: string;
  ended_at: string | null;
  driver_number: string | null;
  route_number: string | null;
}

interface BreadcrumbRow {
  id: string;
  shift_id: string;
  recorded_at: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

interface ReplayEvent {
  at: number;
  text: string;
}

const SPEEDS = [1, 5, 20, 60];

export default function AdminReplay() {
  const [shifts, setShifts] = useState<ShiftSummary[] | null>(null);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [stops, setStops] = useState<RouteStopRow[] | null>(null);
  const [crumbs, setCrumbs] = useState<BreadcrumbRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tick, setTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [crumbIndex, setCrumbIndex] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);
  const [events, setEvents] = useState<ReplayEvent[]>([]);

  const arrivedSinceRef = useRef<number | null>(null);
  const audioFiredForRef = useRef<string | null>(null);
  const lastTickAtRef = useRef<number | null>(null);

  // Load the recent shifts list once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) throw new Error('Supabase not configured');
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('shifts')
          .select('id, driver_id, route_id, started_at, ended_at, drivers(driver_number), routes(route_number)')
          .order('started_at', { ascending: false })
          .limit(40);
        if (error) throw error;
        if (cancelled) return;
        const rows: ShiftSummary[] = (data ?? []).map((r) => {
          const driver = r.drivers as { driver_number: string } | null;
          const route = r.routes as { route_number: string } | null;
          return {
            id: r.id,
            driver_id: r.driver_id,
            route_id: r.route_id,
            started_at: r.started_at,
            ended_at: r.ended_at,
            driver_number: driver?.driver_number ?? null,
            route_number: route?.route_number ?? null,
          };
        });
        setShifts(rows);
      } catch (err) {
        if (!cancelled) setShiftsError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stop simulator when leaving the page.
  useEffect(() => {
    return () => {
      setSimulatedPosition(null);
    };
  }, []);

  // Load breadcrumbs + stops when a shift is selected.
  async function loadShift(shift: ShiftSummary) {
    setLoading(true);
    setLoadError(null);
    setCrumbs(null);
    setStops(null);
    setSelectedShiftId(shift.id);
    setIsPlaying(false);
    setCrumbIndex(0);
    setStopIndex(0);
    setEvents([]);
    audioFiredForRef.current = null;
    arrivedSinceRef.current = null;
    setSimulatedPosition(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('gps_breadcrumbs')
        .select('id, shift_id, recorded_at, lat, lng, heading, speed')
        .eq('shift_id', shift.id)
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      const crumbRows = (data ?? []) as BreadcrumbRow[];
      if (crumbRows.length === 0) throw new Error('No breadcrumbs for this shift.');

      const stopsResult = await loadRouteStops(shift.route_id);
      setCrumbs(crumbRows);
      setStops(stopsResult.rows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setSelectedShiftId(null);
    } finally {
      setLoading(false);
    }
  }

  // Wall-clock 250 ms ticker drives playback.
  useEffect(() => {
    if (!isPlaying) {
      lastTickAtRef.current = null;
      return;
    }
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  // Each tick: advance the breadcrumb cursor by elapsed real-time × speed,
  // push the current position into the simulator, then run the same
  // banner-advance and audio-trigger checks the live Run screen uses.
  useEffect(() => {
    if (!isPlaying || !crumbs || !stops || crumbs.length === 0) return;

    const now = Date.now();
    const last = lastTickAtRef.current ?? now;
    lastTickAtRef.current = now;

    const advanceMs = (now - last) * speed;

    let nextIdx = crumbIndex;
    if (nextIdx >= crumbs.length - 1) {
      setIsPlaying(false);
      pushEvent('Playback finished.');
      return;
    }

    const startTime = new Date(crumbs[crumbIndex].recorded_at).getTime();
    const targetTime = startTime + advanceMs;
    while (
      nextIdx + 1 < crumbs.length &&
      new Date(crumbs[nextIdx + 1].recorded_at).getTime() <= targetTime
    ) {
      nextIdx += 1;
    }
    if (nextIdx !== crumbIndex) setCrumbIndex(nextIdx);

    const cb = crumbs[nextIdx];
    setSimulatedPosition({ lat: cb.lat, lng: cb.lng, heading: cb.heading });

    if (stopIndex < stops.length) {
      const stop = stops[stopIndex];
      const haversine =
        stop.lat != null && stop.lng != null
          ? haversineMetres(cb.lat, cb.lng, stop.lat, stop.lng)
          : null;

      // Audio trigger.
      const audioKey = `${stop.id}-audio`;
      if (
        haversine != null &&
        haversine <= AUDIO_TRIGGER_M &&
        audioFiredForRef.current !== audioKey
      ) {
        audioFiredForRef.current = audioKey;
        pushEvent(`Audio cue would fire for #${stopIndex + 1} ${stop.stop_name} (${Math.round(haversine)} m)`);
      }

      // Auto-advance:
      //   - Stops: passed-waypoint OR 8 s dwell inside ARRIVED_DISTANCE_M.
      //   - Turns: passed-waypoint only — being inside the geofence just
      //     means the bus is approaching the turn, not that it's executed.
      const passed = hasPassedWaypoint(cb.lat, cb.lng, stops, stopIndex);
      const isTurn = stop.kind === 'turn';
      const inside = haversine != null && haversine <= ARRIVED_DISTANCE_M;

      if (passed) {
        advanceStop(stopIndex, 'passed-waypoint');
      } else if (isTurn) {
        arrivedSinceRef.current = null;
      } else if (inside) {
        if (arrivedSinceRef.current == null) arrivedSinceRef.current = now;
        if (now - (arrivedSinceRef.current ?? now) >= ARRIVAL_DWELL_MS_STOP) {
          advanceStop(stopIndex, `dwell ${ARRIVAL_DWELL_MS_STOP / 1000}s`);
        }
      } else {
        arrivedSinceRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  function advanceStop(fromIdx: number, reason: string) {
    setStopIndex((i) => (i === fromIdx ? i + 1 : i));
    arrivedSinceRef.current = null;
    audioFiredForRef.current = null;
    if (stops) {
      const stop = stops[fromIdx];
      pushEvent(`Banner advance: #${fromIdx + 1} ${stop?.stop_name ?? ''} → next (${reason})`);
    }
  }

  function pushEvent(text: string) {
    setEvents((prev) => [{ at: Date.now(), text }, ...prev].slice(0, 80));
  }

  function reset() {
    setIsPlaying(false);
    setCrumbIndex(0);
    setStopIndex(0);
    setEvents([]);
    arrivedSinceRef.current = null;
    audioFiredForRef.current = null;
    setSimulatedPosition(null);
  }

  const currentCrumb = crumbs && crumbs[crumbIndex];
  const currentStop = stops && stopIndex < stops.length ? stops[stopIndex] : null;
  const distanceToStop =
    currentCrumb && currentStop?.lat != null && currentStop?.lng != null
      ? haversineMetres(currentCrumb.lat, currentCrumb.lng, currentStop.lat, currentStop.lng)
      : null;

  const elapsed = useMemo(() => {
    if (!crumbs || crumbs.length === 0) return null;
    const start = new Date(crumbs[0].recorded_at).getTime();
    const at = new Date(crumbs[crumbIndex].recorded_at).getTime();
    return Math.round((at - start) / 1000);
  }, [crumbs, crumbIndex]);

  const total = useMemo(() => {
    if (!crumbs || crumbs.length === 0) return null;
    const start = new Date(crumbs[0].recorded_at).getTime();
    const end = new Date(crumbs[crumbs.length - 1].recorded_at).getTime();
    return Math.round((end - start) / 1000);
  }, [crumbs]);

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-3">
        <Link to="/admin" className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
          ← Back to admin
        </Link>
        <h1 className="text-3xl font-black">Replay run</h1>
        <span />
      </header>

      <p className="text-sm text-slate-400">
        Pick a past shift. Its breadcrumbs feed the GPS simulator and the same auto-advance + audio
        logic the live run screen uses runs locally — useful for re-testing nav fixes on a known route.
        Nothing is written back.
      </p>

      {!selectedShiftId && (
        <section className="flex flex-col gap-2 rounded-2xl bg-slate-800 p-4">
          <h2 className="font-bold">Recent shifts</h2>
          {shiftsError && <p className="text-sm text-red-300">{shiftsError}</p>}
          {!shifts && !shiftsError && <p className="text-slate-400">Loading…</p>}
          {shifts && shifts.length === 0 && <p className="text-slate-400">No shifts found.</p>}
          <ul className="flex flex-col gap-1">
            {shifts?.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => loadShift(s)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-left hover:bg-slate-700"
                >
                  <div>
                    <div className="font-bold">
                      {s.route_number ?? s.route_id.slice(0, 8)} · driver {s.driver_number ?? '?'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(s.started_at).toLocaleString()} · {s.ended_at ? 'ended' : 'open'}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{s.id.slice(0, 8)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading && <p className="text-slate-400">Loading shift data…</p>}
      {loadError && <p className="rounded-2xl bg-red-500/15 p-3 text-sm text-red-200">{loadError}</p>}

      {selectedShiftId && crumbs && stops && (
        <section className="flex flex-col gap-3 rounded-2xl bg-slate-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Playback</h2>
            <button
              type="button"
              onClick={() => {
                setSelectedShiftId(null);
                setCrumbs(null);
                setStops(null);
                reset();
              }}
              className="text-xs text-slate-400 underline-offset-4 hover:underline"
            >
              pick a different shift
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-900 hover:bg-emerald-400"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl bg-slate-700 px-4 py-3 text-sm text-slate-200 hover:bg-slate-600"
            >
              Reset
            </button>
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    speed === s
                      ? 'bg-emerald-500 text-slate-900'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={crumbs.length - 1}
            value={crumbIndex}
            onChange={(e) => {
              const next = Number(e.target.value);
              setCrumbIndex(next);
              setIsPlaying(false);
              const cb = crumbs[next];
              setSimulatedPosition({ lat: cb.lat, lng: cb.lng, heading: cb.heading });
            }}
            className="w-full"
          />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-400">Breadcrumb</div>
              <div className="font-mono">
                {crumbIndex + 1} / {crumbs.length}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Time elapsed</div>
              <div className="font-mono">
                {elapsed != null ? formatSeconds(elapsed) : '—'} / {total != null ? formatSeconds(total) : '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Position</div>
              <div className="font-mono text-xs">
                {currentCrumb ? `${currentCrumb.lat.toFixed(5)}, ${currentCrumb.lng.toFixed(5)}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Heading</div>
              <div className="font-mono">
                {currentCrumb?.heading != null ? `${Math.round(currentCrumb.heading)}°` : '—'}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900 p-3">
            <div className="text-xs uppercase tracking-widest text-slate-400">Next instruction</div>
            {currentStop ? (
              <>
                <div className="text-lg font-bold">
                  #{stopIndex + 1} ({currentStop.kind}) · {currentStop.stop_name}
                </div>
                {currentStop.instruction_text && (
                  <div className="text-sm text-slate-300">{currentStop.instruction_text}</div>
                )}
                <div className="mt-1 text-sm text-slate-400">
                  in {distanceToStop != null ? formatMetres(distanceToStop) : '—'}
                </div>
              </>
            ) : (
              <div className="text-slate-300">Run finished — all stops done.</div>
            )}
          </div>

          <div className="rounded-xl bg-slate-900 p-3">
            <div className="text-xs uppercase tracking-widest text-slate-400">Event log</div>
            {events.length === 0 ? (
              <div className="text-sm text-slate-500">No events yet — press Play.</div>
            ) : (
              <ol className="mt-2 flex flex-col gap-1 font-mono text-xs">
                {events.map((e) => (
                  <li key={`${e.at}-${e.text}`} className="text-slate-200">
                    <span className="text-slate-500">{new Date(e.at).toLocaleTimeString()}</span>{' '}
                    {e.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMetres(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
