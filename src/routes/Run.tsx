import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../state/SessionProvider';
import { loadRouteStops } from '../lib/routes';
import { recordBreadcrumb, recordShift, recordStopEvent } from '../lib/sync';
import {
  bandClass,
  formatElapsed,
  statusForScheduled,
  useActiveShift,
  useRunSnapshot,
  type OnTimeStatus,
} from '../lib/runState';
import {
  cancelSpeech,
  isMuted as isSpeechMuted,
  isSpeechSupported,
  isUnlocked as isSpeechUnlocked,
  setMuted as setSpeechMuted,
  speak,
  unlockSpeech,
} from '../lib/speech';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { haversineMetres, useGeolocation } from '../lib/geo';
import { distanceAlongRouteToIndex, directionFromInstruction } from '../lib/turfUtils';
import RouteMap from '../components/RouteMap';
import { RouteSimulator } from '../components/RouteSimulator';

const AUDIO_TRIGGER_M = 150;
const APPROACHING_DISTANCE_M = 200;
const ARRIVED_DISTANCE_M = 50;
const ARRIVAL_DWELL_MS_STOP = 8_000;
const ARRIVAL_DWELL_MS_TURN = 0;
const BREADCRUMB_INTERVAL_MS = 5_000;
const GEO_PREF_KEY = 'drivermate.gpsAutoAdvance';

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function newId(): string {
  return crypto.randomUUID();
}

function readGpsPref(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(GEO_PREF_KEY) !== '0';
}

function writeGpsPref(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GEO_PREF_KEY, value ? '1' : '0');
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export default function Run() {
  const navigate = useNavigate();
  const { driver } = useSession();
  const shift = useActiveShift(driver?.id ?? null);
  const snapshot = useRunSnapshot(shift);
  const now = useNow();
  const [currentCount, setCurrentCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(isSpeechUnlocked());
  const [muted, setMutedState] = useState(isSpeechMuted());
  const [gpsEnabled, setGpsEnabled] = useState(readGpsPref());
  const online = useOnlineStatus();
  const pending = useLiveQuery(() => db.pending.count(), [], 0);
  const routeRow = useLiveQuery(
    () => (shift ? db.routes.get(shift.route_id) : undefined),
    [shift?.route_id],
  );
  const geo = useGeolocation(gpsEnabled);
  const arrivedSinceRef = useRef<number | null>(null);
  const autoAdvancedStopRef = useRef<string | null>(null);
  const audioSpokenForRef = useRef<string | null>(null);

  useEffect(() => {
    if (shift) loadRouteStops(shift.route_id);
  }, [shift?.route_id]);

  useEffect(() => {
    if (shift === null && driver) navigate('/routes', { replace: true });
  }, [shift, driver, navigate]);

  const { stops, currentIndex, totalPickups, done } = snapshot;
  const currentStop = stops[currentIndex];
  const displayTotal = totalPickups + currentCount;

  const busLat = geo.kind === 'fix' ? geo.position.lat : null;
  const busLng = geo.kind === 'fix' ? geo.position.lng : null;
  const busHeading = geo.kind === 'fix' ? (geo.position.heading ?? null) : null;

  const distanceToStop =
    busLat != null && busLng != null && currentStop?.lat != null && currentStop?.lng != null
      ? haversineMetres(busLat, busLng, currentStop.lat, currentStop.lng)
      : null;

  const distanceAlongRoute =
    busLat != null && busLng != null && currentIndex < stops.length
      ? distanceAlongRouteToIndex(busLat, busLng, stops, currentIndex)
      : null;

  const distanceDisplay = distanceAlongRoute ?? distanceToStop;

  // Find next scheduled stop (kind='stop') at or after currentIndex
  const nextScheduledStop = stops.slice(currentIndex).find((s) => s.kind === 'stop') ?? null;

  // Next stop scheduled-time status
  const nextStopStatus: OnTimeStatus = nextScheduledStop
    ? statusForScheduled(nextScheduledStop.scheduled_time, now)
    : 'ontime';

  // Reset arrival dwell timer when current stop changes
  useEffect(() => {
    arrivedSinceRef.current = null;
  }, [currentStop?.id]);

  // Distance-based audio: speak instruction when ≤ AUDIO_TRIGGER_M to current stop/turn
  useEffect(() => {
    if (!currentStop || !audioUnlocked || muted) return;
    const text = currentStop.instruction_audio_cue || currentStop.instruction_text;
    if (!text) return;
    const key = `${currentStop.id}-audio`;
    if (audioSpokenForRef.current === key) return;
    if (distanceDisplay != null && distanceDisplay <= AUDIO_TRIGGER_M) {
      audioSpokenForRef.current = key;
      speak(text);
    }
  }, [currentStop?.id, distanceDisplay, audioUnlocked, muted]);

  // GPS geofence auto-advance
  const dwellMs = currentStop?.kind === 'turn' ? ARRIVAL_DWELL_MS_TURN : ARRIVAL_DWELL_MS_STOP;
  useEffect(() => {
    if (!shift || !currentStop || distanceToStop == null) return;
    if (autoAdvancedStopRef.current === currentStop.id) return;

    if (distanceToStop > ARRIVED_DISTANCE_M) {
      arrivedSinceRef.current = null;
      return;
    }

    if (arrivedSinceRef.current == null) {
      arrivedSinceRef.current = Date.now();
      if (dwellMs > 0) return;
    }

    if (Date.now() - arrivedSinceRef.current! >= dwellMs) {
      autoAdvancedStopRef.current = currentStop.id;
      arrivedSinceRef.current = null;
      logCurrentStop({ source: 'gps' });
    }
  }, [distanceToStop, currentStop?.id, shift?.id, dwellMs]);

  // GPS breadcrumb recorder — captures one fix every 5s while a shift is active.
  // Doubles as Vic Bus Safety Reg 31 retention data and as the source for
  // road-following polylines (see admin "Use trace as route line" tool).
  const geoRef = useRef(geo);
  geoRef.current = geo;
  useEffect(() => {
    if (!shift || shift.ended_at) return;
    const tick = () => {
      const g = geoRef.current;
      if (g.kind !== 'fix') return;
      const p = g.position;
      void recordBreadcrumb({
        id: newId(),
        shift_id: shift.id,
        recorded_at: new Date(p.timestamp).toISOString(),
        lat: p.lat,
        lng: p.lng,
        heading: p.heading,
        speed: p.speed,
        accuracy: p.accuracy,
        synced_at: null,
      });
    };
    const id = window.setInterval(tick, BREADCRUMB_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [shift?.id, shift?.ended_at]);

  if (shift === undefined || shift === null) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">
        Loading shift…
      </main>
    );
  }

  function handleUnlock() {
    unlockSpeech();
    setAudioUnlocked(true);
  }

  function toggleMute() {
    const next = !muted;
    setSpeechMuted(next);
    setMutedState(next);
    if (next) cancelSpeech();
  }

  function toggleGps() {
    const next = !gpsEnabled;
    setGpsEnabled(next);
    writeGpsPref(next);
  }

  async function logCurrentStop(opts: { source: 'manual' | 'gps' } = { source: 'manual' }) {
    if (!shift || !currentStop) return;
    cancelSpeech();
    const isTurn = currentStop.kind === 'turn';
    const noteParts: string[] = [];
    if (opts.source === 'gps') noteParts.push('auto-advanced via GPS');
    if (isTurn) noteParts.push('turn waypoint');
    const note = noteParts.length > 0 ? noteParts.join('; ') : null;
    const count = isTurn ? 0 : currentCount;
    await recordStopEvent({
      id: newId(),
      shift_id: shift.id,
      route_stop_id: currentStop.id,
      arrived_at: new Date().toISOString(),
      pickup_count: count,
      note,
      synced_at: null,
    });
    audioSpokenForRef.current = null;
    setCurrentCount(0);
    if (audioUnlocked && !muted) {
      const utterance = isTurn
        ? 'Turn complete.'
        : `${count} logged at ${currentStop.stop_name}.`;
      speak(utterance, { dedupe: false, preempt: true });
    }
  }

  async function endRun() {
    if (!shift || ending) return;
    setEnding(true);
    cancelSpeech();
    await recordShift({ ...shift, ended_at: new Date().toISOString() });
    navigate('/run/end');
  }

  // GPS status badge
  let gpsBadge: { label: string; cls: string } = {
    label: 'GPS off',
    cls: 'bg-slate-700 text-slate-400',
  };
  if (gpsEnabled) {
    if (geo.kind === 'fix') {
      gpsBadge = {
        label: distanceDisplay != null ? `GPS · ${formatDistance(distanceDisplay)}` : 'GPS ✓',
        cls: 'bg-emerald-500/20 text-emerald-300',
      };
    } else if (geo.kind === 'permission_denied') {
      gpsBadge = { label: 'GPS denied', cls: 'bg-red-500/20 text-red-300' };
    } else {
      gpsBadge = { label: 'GPS waiting…', cls: 'bg-amber-500/20 text-amber-300' };
    }
  }

  // Proximity banner
  let proximityBanner: { label: string; cls: string; showManual: boolean } | null = null;
  if (distanceToStop != null && currentStop) {
    const isTurn = currentStop.kind === 'turn';
    if (distanceToStop <= ARRIVED_DISTANCE_M) {
      if (autoAdvancedStopRef.current === currentStop.id) {
        proximityBanner = {
          label: isTurn ? 'Turn passed.' : 'Stop logged ✓',
          cls: 'bg-emerald-500/20 text-emerald-200',
          showManual: false,
        };
      } else {
        const elapsed = arrivedSinceRef.current ? Date.now() - arrivedSinceRef.current : 0;
        const remaining = Math.max(0, Math.ceil((dwellMs - elapsed) / 1000));
        proximityBanner = isTurn
          ? { label: 'At turn — advancing.', cls: 'bg-blue-500/20 text-blue-200', showManual: false }
          : {
              label: `Arrived · auto-logging in ${remaining}s`,
              cls: 'bg-emerald-500/20 text-emerald-200',
              showManual: true,
            };
      }
    } else if (distanceToStop <= APPROACHING_DISTANCE_M) {
      proximityBanner = {
        label: `${isTurn ? 'Turn ahead' : 'Approaching'} · ${formatDistance(distanceToStop)}`,
        cls: 'bg-blue-500/15 text-blue-200',
        showManual: false,
      };
    }
  }

  // Direction arrow for turn banner
  const turnArrow = directionFromInstruction(currentStop?.instruction_text ?? null);

  return (
    <main className="flex h-full flex-col bg-slate-900 overflow-hidden">
      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-400 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span>{formatElapsed(shift.started_at, now)}</span>
          <span
            className={`rounded-full px-2 py-0.5 uppercase tracking-widest ${
              online ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {online ? (pending ? `Sync: ${pending}` : 'Online') : 'Offline'}
          </span>
          <button
            type="button"
            onClick={toggleGps}
            className={`rounded-full px-2 py-0.5 uppercase tracking-widest ${gpsBadge.cls}`}
          >
            {gpsBadge.label}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isSpeechSupported() && audioUnlocked && (
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-full border border-slate-700 px-2 py-0.5 uppercase tracking-widest"
            >
              {muted ? 'Muted' : 'Audio on'}
            </button>
          )}
          <button
            type="button"
            onClick={endRun}
            disabled={ending}
            className="rounded-full bg-slate-700 px-3 py-0.5 font-semibold text-slate-200 active:bg-slate-600 disabled:opacity-50"
          >
            {ending ? 'Ending…' : 'End run'}
          </button>
        </div>
      </div>

      {/* ── Audio unlock prompt ─────────────────────────────────────────── */}
      {isSpeechSupported() && !audioUnlocked && (
        <button
          type="button"
          onClick={handleUnlock}
          className="shrink-0 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 text-center border-b border-emerald-500/20"
        >
          Tap once to enable spoken instructions
        </button>
      )}

      {/* ── Next turn banner ────────────────────────────────────────────── */}
      {currentStop ? (
        <div className={`shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-700 ${bandClass(nextStopStatus)}`}>
          {currentStop.kind === 'turn' && (
            <span className="text-4xl leading-none font-bold">{turnArrow}</span>
          )}
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight truncate">
              {currentStop.instruction_text || currentStop.stop_name}
            </p>
            {distanceDisplay != null && (
              <p className="text-sm opacity-70">in {formatDistance(distanceDisplay)}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-3 border-b border-slate-700 text-slate-400 text-sm">
          {done ? 'All stops complete — tap End run.' : 'No stops loaded for this route.'}
        </div>
      )}

      {/* ── Next scheduled stop strip ──────────────────────────────────── */}
      {nextScheduledStop && nextScheduledStop !== currentStop && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-800/60 border-b border-slate-700 text-sm">
          <span className="text-slate-300 truncate">
            Next stop:{' '}
            <span className="font-semibold text-white">{nextScheduledStop.stop_name}</span>
            {nextScheduledStop.scheduled_time && (
              <span className="ml-2 text-slate-400">{nextScheduledStop.scheduled_time.slice(0, 5)}</span>
            )}
          </span>
          <span
            className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${
              nextStopStatus === 'late'
                ? 'bg-red-500/20 text-red-300'
                : nextStopStatus === 'delayed'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {nextStopStatus === 'late' ? 'Late' : nextStopStatus === 'delayed' ? 'Delayed' : 'On time'}
          </span>
        </div>
      )}

      {/* ── Proximity banner (floating over map top) ───────────────────── */}
      {proximityBanner && (
        <div className={`shrink-0 flex items-center justify-between px-4 py-2 text-sm font-semibold border-b border-slate-700 ${proximityBanner.cls}`}>
          <span>{proximityBanner.label}</span>
          {proximityBanner.showManual && (
            <button
              type="button"
              onClick={() => logCurrentStop()}
              className="ml-4 rounded-xl bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-900 active:bg-emerald-400"
            >
              Log now
            </button>
          )}
        </div>
      )}

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <RouteMap
          stops={stops}
          busLat={busLat}
          busLng={busLng}
          busHeading={busHeading}
          currentStopIndex={currentIndex}
          pathGeoJson={routeRow?.path_geojson ?? null}
        />
      </div>

      {/* ── Passenger counter bottom bar ────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-900 border-t border-slate-700">
        <button
          type="button"
          onClick={() => setCurrentCount((c) => Math.max(0, c - 1))}
          aria-label="Remove one"
          className="w-16 h-16 rounded-2xl bg-slate-700 text-3xl font-bold text-slate-100 active:bg-slate-600 select-none"
        >
          −
        </button>

        <div className="flex-1 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400">On bus</p>
          <p className="text-5xl font-bold tabular-nums leading-none">{displayTotal}</p>
          {currentCount > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">+{currentCount} this stop</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCurrentCount((c) => c + 1)}
          aria-label="Add one"
          className="w-20 h-20 rounded-2xl bg-blue-500 text-4xl font-bold text-white active:bg-blue-400 select-none"
        >
          +
        </button>
      </div>

      <RouteSimulator stops={stops} />
    </main>
  );
}
