import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../state/SessionProvider';
import { loadRouteStops } from '../lib/routes';
import { recordShift, recordStopEvent } from '../lib/sync';
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
import { navigateUrlForRemainingStops, navigateUrlForStop } from '../lib/maps';
import { haversineMetres, useGeolocation } from '../lib/geo';

const SPEAK_LOOKAHEAD_MS = 30_000;
const APPROACHING_DISTANCE_M = 200;
const ARRIVED_DISTANCE_M = 50;
// Stops: bus actually parks; require 8s dwell to avoid false triggers.
// Turns: bus only drives through; advance on first GPS hit inside the geofence.
const ARRIVAL_DWELL_MS_STOP = 8_000;
const ARRIVAL_DWELL_MS_TURN = 0;
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

function scheduledTimeToday(scheduled: string, today: Date): Date {
  const [h, m] = scheduled.split(':').map(Number);
  const target = new Date(today);
  target.setHours(h, m, 0, 0);
  return target;
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
  const geo = useGeolocation(gpsEnabled);
  const arrivedSinceRef = useRef<number | null>(null);
  const autoAdvancedStopRef = useRef<string | null>(null);

  useEffect(() => {
    if (shift) loadRouteStops(shift.route_id);
  }, [shift?.route_id]);

  useEffect(() => {
    if (shift === null && driver) navigate('/routes', { replace: true });
  }, [shift, driver, navigate]);

  const { stops, currentIndex, totalPickups, done } = snapshot;
  const currentStop = stops[currentIndex];

  // Distance to current stop (only when both GPS fix and stop coords exist)
  const distanceToStop =
    geo.kind === 'fix' && currentStop?.lat != null && currentStop?.lng != null
      ? haversineMetres(
          geo.position.lat,
          geo.position.lng,
          currentStop.lat,
          currentStop.lng,
        )
      : null;

  // Reset arrival timer when the current stop changes
  useEffect(() => {
    arrivedSinceRef.current = null;
  }, [currentStop?.id]);

  // Speak the current stop's instruction ~30s before its scheduled time.
  useEffect(() => {
    if (!currentStop || !audioUnlocked || muted) return;
    const text = currentStop.instruction_audio_cue || currentStop.instruction_text;
    if (!text) return;
    if (!currentStop.scheduled_time) {
      speak(text);
      return;
    }
    const target = scheduledTimeToday(currentStop.scheduled_time, now);
    const triggerAt = target.getTime() - SPEAK_LOOKAHEAD_MS;
    if (now.getTime() >= triggerAt) speak(text);
  }, [currentStop?.id, audioUnlocked, muted, now]);

  // Geofence auto-advance: once the bus has been within ARRIVED_DISTANCE for
  // the per-kind dwell time, log the stop_event (or 0-count turn passing).
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

  if (shift === undefined || shift === null) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">
        Loading shift…
      </main>
    );
  }

  const status: OnTimeStatus = currentStop
    ? statusForScheduled(currentStop.scheduled_time, now)
    : 'ontime';

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
    if (opts.source === 'gps') noteParts.push('auto-advanced via GPS geofence');
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
    setCurrentCount(0);
    if (audioUnlocked && !muted) {
      const utterance = isTurn
        ? `Turn complete.`
        : `Logged ${count} at ${currentStop.stop_name}.`;
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

  // GPS status text for the small badge in the header
  let gpsBadge: { label: string; tone: 'good' | 'warn' | 'off' } = { label: 'GPS off', tone: 'off' };
  if (gpsEnabled) {
    if (geo.kind === 'fix') {
      gpsBadge =
        distanceToStop != null
          ? { label: `GPS · ${formatDistance(distanceToStop)}`, tone: 'good' }
          : { label: 'GPS · no stop coords', tone: 'warn' };
    } else if (geo.kind === 'permission_denied') {
      gpsBadge = { label: 'GPS denied', tone: 'warn' };
    } else if (geo.kind === 'unsupported') {
      gpsBadge = { label: 'GPS unsupported', tone: 'warn' };
    } else if (geo.kind === 'unavailable') {
      gpsBadge = { label: 'GPS unavailable', tone: 'warn' };
    } else {
      gpsBadge = { label: 'GPS waiting…', tone: 'warn' };
    }
  }
  const gpsBadgeClass =
    gpsBadge.tone === 'good'
      ? 'bg-emerald-500/15 text-emerald-200'
      : gpsBadge.tone === 'warn'
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-slate-700 text-slate-300';

  // Approaching / arrived banner
  let proximityBanner: { label: string; className: string } | null = null;
  if (distanceToStop != null && currentStop) {
    const isTurn = currentStop.kind === 'turn';
    if (distanceToStop <= ARRIVED_DISTANCE_M) {
      if (autoAdvancedStopRef.current === currentStop.id) {
        proximityBanner = {
          label: isTurn ? 'Turn passed.' : 'Auto-logged this stop.',
          className: 'bg-emerald-500/20 text-emerald-100',
        };
      } else if (isTurn) {
        proximityBanner = {
          label: 'At turn — advancing.',
          className: 'bg-blue-500/20 text-blue-100',
        };
      } else {
        const elapsedAtStop = arrivedSinceRef.current
          ? Math.max(0, ARRIVAL_DWELL_MS_STOP - (Date.now() - arrivedSinceRef.current))
          : ARRIVAL_DWELL_MS_STOP;
        const seconds = Math.ceil(elapsedAtStop / 1000);
        proximityBanner = {
          label: `Arrived. Auto-logging in ${seconds}s — keep counting.`,
          className: 'bg-emerald-500/20 text-emerald-100',
        };
      }
    } else if (distanceToStop <= APPROACHING_DISTANCE_M) {
      proximityBanner = {
        label: `${isTurn ? 'Turn ahead' : 'Approaching'} · ${formatDistance(distanceToStop)} to go`,
        className: 'bg-blue-500/15 text-blue-100',
      };
    }
  }

  return (
    <main className="flex min-h-full flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-sm text-slate-400">
        <div className="flex items-center gap-3">
          <span>{formatElapsed(shift.started_at, now)} elapsed</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-widest ${
              online
                ? 'bg-emerald-500/15 text-emerald-200'
                : 'bg-amber-500/15 text-amber-200'
            }`}
            title={pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to upload` : undefined}
          >
            {online ? (pending ? `Sync: ${pending} queued` : 'Online') : 'Offline'}
          </span>
          <button
            type="button"
            onClick={toggleGps}
            className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-widest ${gpsBadgeClass}`}
            title={gpsEnabled ? 'Tap to disable GPS auto-advance' : 'Tap to enable GPS auto-advance'}
          >
            {gpsBadge.label}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Step {Math.min(currentIndex + 1, stops.length)} of {stops.length || '—'}
          </span>
          {isSpeechSupported() && audioUnlocked && (
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-widest text-slate-300"
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            >
              {muted ? 'Muted' : 'Audio on'}
            </button>
          )}
        </div>
      </header>

      {isSpeechSupported() && !audioUnlocked && (
        <button
          type="button"
          onClick={handleUnlock}
          className="rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200"
        >
          Tap once to enable spoken instructions.
        </button>
      )}

      {proximityBanner && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${proximityBanner.className}`}>
          {proximityBanner.label}
        </div>
      )}

      {currentStop ? (
        <>
          <section className={`rounded-3xl p-5 ${bandClass(status)}`}>
            <p className="text-xs uppercase tracking-widest opacity-70">
              {currentStop.kind === 'turn' ? 'Next turn' : 'Next instruction'}
            </p>
            <p className="mt-2 text-instruction">
              {currentStop.instruction_text || currentStop.stop_name}
            </p>
          </section>

          <section className="rounded-3xl bg-slate-800 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              {currentStop.kind === 'turn' ? 'Turn' : 'Stop'}
            </p>
            <p className="text-stop">
              {currentStop.stop_name}
              {currentStop.scheduled_time && (
                <span className="ml-3 align-baseline text-base font-medium text-slate-400">
                  {currentStop.scheduled_time.slice(0, 5)}
                </span>
              )}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={navigateUrlForStop(currentStop.stop_name, currentStop.lat, currentStop.lng)}
                target="_blank"
                rel="noreferrer"
                className="min-h-touch rounded-2xl bg-blue-500 px-4 py-3 text-center text-lg font-bold text-slate-900 active:bg-blue-400"
              >
                {currentStop.kind === 'turn' ? 'Navigate to this turn' : 'Navigate to this stop'}
              </a>
              {(() => {
                const remaining = stops.slice(currentIndex);
                const url = navigateUrlForRemainingStops(remaining);
                if (!url || remaining.length < 2) return <span />;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-touch rounded-2xl bg-slate-700 px-4 py-3 text-center text-lg font-bold text-slate-100 active:bg-slate-600"
                  >
                    Navigate full route
                  </a>
                );
              })()}
            </div>
          </section>

          {currentStop.kind === 'turn' ? (
            <section className="rounded-3xl bg-slate-800 p-5 text-center">
              <p className="text-sm text-slate-400">
                Pass through this turn — counter is hidden until the next stop.
              </p>
              <button
                type="button"
                onClick={() => logCurrentStop()}
                className="btn-primary mt-3"
              >
                Turn done
              </button>
            </section>
          ) : (
            <section className="rounded-3xl bg-slate-800 p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400">Picked up here</p>
              <p className="text-counter">{currentCount}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentCount((c) => Math.max(0, c - 1))}
                  className="btn-secondary"
                  aria-label="Decrease count"
                >
                  &minus;
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentCount((c) => c + 1)}
                  className="btn-primary"
                  aria-label="Increase count"
                >
                  +
                </button>
              </div>
              <button type="button" onClick={() => logCurrentStop()} className="btn-primary mt-3">
                Stop reached
              </button>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-3xl bg-emerald-500/10 p-5 text-center">
          <p className="text-stop text-emerald-200">
            {done ? 'All stops complete.' : 'No stops loaded for this route yet.'}
          </p>
          <p className="mt-2 text-slate-300">
            {done
              ? 'Tap “End run” to finish and sync.'
              : 'Ask an admin to add stops to this route.'}
          </p>
        </section>
      )}

      <section className="mt-auto flex items-center justify-between rounded-3xl bg-slate-800 p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">On bus today</p>
          <p className="text-counter leading-none">{totalPickups}</p>
        </div>
        <button type="button" onClick={endRun} className="btn-secondary w-auto px-6" disabled={ending}>
          {ending ? 'Ending…' : 'End run'}
        </button>
      </section>
    </main>
  );
}
