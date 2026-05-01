import { useEffect, useRef, useState } from 'react';
import { setSimulatedPosition } from '../lib/simulator';
import { isSimEnabled } from '../lib/simFlag';
import type { RouteStopRow } from '../lib/db';

interface Props {
  stops: RouteStopRow[];
}

const STOP_DWELL_MS = 9_500;
const TURN_DWELL_MS = 1_500;

export function RouteSimulator({ stops }: Props) {
  // Dev builds always show the simulator. Production builds only render it
  // when the sim flag is set (?sim=1 in URL or pinned in sessionStorage).
  // Real drivers never pass the flag, so the SIM button stays hidden.
  if (!import.meta.env.DEV && !isSimEnabled()) return null;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playTimer = useRef<number | null>(null);

  const total = stops.length;
  const current = stops[idx] ?? null;

  // Emit position every second while active (mimics real GPS jitter at
  // standstill — needed so the Run screen's dwell timer keeps re-checking).
  useEffect(() => {
    if (!active) {
      setSimulatedPosition(null);
      return;
    }
    if (!current || current.lat == null || current.lng == null) return;
    const baseLat = current.lat;
    const baseLng = current.lng;
    const emit = () => {
      // ~2m of jitter so distanceToStop changes slightly between ticks
      const jitterLat = (Math.random() - 0.5) * 0.00003;
      const jitterLng = (Math.random() - 0.5) * 0.00003;
      setSimulatedPosition({ lat: baseLat + jitterLat, lng: baseLng + jitterLng });
    };
    emit();
    const id = window.setInterval(emit, 1000);
    return () => window.clearInterval(id);
  }, [active, idx, current]);

  // Stop simulator on unmount
  useEffect(() => {
    return () => setSimulatedPosition(null);
  }, []);

  // Play loop — wait per-point dwell, then advance
  useEffect(() => {
    if (playTimer.current !== null) {
      window.clearTimeout(playTimer.current);
      playTimer.current = null;
    }
    if (!playing || !active || !current) return;
    if (idx >= total - 1) {
      setPlaying(false);
      return;
    }
    const dwell = current.kind === 'stop' ? STOP_DWELL_MS : TURN_DWELL_MS;
    const wait = Math.max(300, Math.round(dwell / speed));
    playTimer.current = window.setTimeout(() => {
      setIdx((i) => Math.min(i + 1, total - 1));
    }, wait);
    return () => {
      if (playTimer.current !== null) {
        window.clearTimeout(playTimer.current);
        playTimer.current = null;
      }
    };
  }, [playing, active, current, idx, total, speed]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-32 right-3 z-50 rounded-full bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-lg active:bg-purple-500"
      >
        SIM
      </button>
    );
  }

  const stop = current;
  const label = stop ? `${stop.kind === 'stop' ? '★' : '↳'} ${stop.stop_name}` : '—';

  return (
    <div className="fixed bottom-32 right-3 z-50 w-72 rounded-xl bg-slate-900/95 border border-purple-500 shadow-2xl text-white text-sm select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-500/40">
        <span className="font-bold text-purple-300">🎮 Simulator</span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white px-2">×</button>
      </div>

      <div className="p-3 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span>Override GPS</span>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              if (!e.target.checked) setPlaying(false);
            }}
            className="h-5 w-5 accent-purple-500"
          />
        </label>

        <div className="rounded-lg bg-slate-800 p-2 text-xs">
          <div className="text-slate-400">Position {idx + 1} / {total}</div>
          <div className="font-semibold mt-1 text-base leading-snug">{label}</div>
          {stop?.scheduled_time && (
            <div className="text-purple-300 mt-0.5">{stop.scheduled_time.slice(0, 5)}</div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1">
          <button
            onClick={() => { setIdx(0); setPlaying(false); }}
            disabled={!active}
            className="rounded bg-slate-700 py-1.5 text-xs disabled:opacity-30 active:bg-slate-600"
          >⏮</button>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={!active || idx === 0}
            className="rounded bg-slate-700 py-1.5 text-xs disabled:opacity-30 active:bg-slate-600"
          >◀</button>
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!active}
            className={`rounded py-1.5 text-xs disabled:opacity-30 ${playing ? 'bg-amber-500 text-slate-900' : 'bg-emerald-500 text-slate-900'}`}
          >{playing ? '⏸' : '▶'}</button>
          <button
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={!active || idx >= total - 1}
            className="rounded bg-slate-700 py-1.5 text-xs disabled:opacity-30 active:bg-slate-600"
          >▶</button>
          <button
            onClick={() => { setIdx(total - 1); setPlaying(false); }}
            disabled={!active}
            className="rounded bg-slate-700 py-1.5 text-xs disabled:opacity-30 active:bg-slate-600"
          >⏭</button>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Speed</span>
          <div className="flex gap-1">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 ${speed === s ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-500 leading-snug">
          Active dwell: {current?.kind === 'stop' ? `${STOP_DWELL_MS / 1000}s` : `${TURN_DWELL_MS / 1000}s`} ÷ {speed}× = {Math.round(((current?.kind === 'stop' ? STOP_DWELL_MS : TURN_DWELL_MS) / speed) / 100) / 10}s. Stops need ≥8s for the app to log them.
        </p>
      </div>
    </div>
  );
}
