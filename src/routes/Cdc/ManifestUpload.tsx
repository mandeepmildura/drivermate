import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ALL_STOP_CODES, ROUTES, STOP_NAMES } from '../../lib/cdc/stops';
import { clearRunState, loadRunState, newId, saveRunState } from '../../lib/cdc/state';
import { stopSummary } from '../../lib/cdc/tally';
import { ROUTE_THEMES } from '../../lib/cdc/theme';
import type { Passenger, RouteCode, StopCode, TicketType } from '../../lib/cdc/types';
import { getSupabase } from '../../lib/supabase';
import { CountBadge, SeatPill } from './ui';

type ImageItem = { id: string; file: File; previewUrl: string; base64: string; mediaType: string };

const ROUTE_KEY = 'drivermate.cdc.lastRoute';

function isValidStop(code: string): code is StopCode {
  return (ALL_STOP_CODES as string[]).includes(code);
}

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { base64: btoa(binary), mediaType: file.type || 'image/jpeg' };
}

export default function ManifestUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return');
  const routeQuery = searchParams.get('route');
  const existing = useMemo(loadRunState, []);
  const [routeCode, setRouteCode] = useState<RouteCode>(() => {
    if (routeQuery === 'C011' || routeQuery === 'C012') return routeQuery;
    if (existing) return existing.routeCode;
    const last = localStorage.getItem(ROUTE_KEY);
    return last === 'C011' || last === 'C012' ? last : 'C012';
  });
  const [images, setImages] = useState<ImageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>(existing?.passengers ?? []);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(ROUTE_KEY, routeCode);
  }, [routeCode]);

  useEffect(() => {
    return () => {
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
  }, [images]);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list).slice(0, 5 - images.length);
    const items: ImageItem[] = [];
    for (const file of incoming) {
      const { base64, mediaType } = await fileToBase64(file);
      items.push({
        id: newId(),
        file,
        previewUrl: URL.createObjectURL(file),
        base64,
        mediaType,
      });
    }
    setImages((prev) => [...prev, ...items]);
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function readManifest() {
    if (images.length === 0) {
      setError('Add at least one photo of the manifest first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: sessionData } = await getSupabase().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Session expired. Please sign in again.');
      }
      const res = await fetch('/api/vline-ocr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeCode,
          images: images.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Reader failed (${res.status})`);
      }
      const data = (await res.json()) as { passengers?: unknown };
      const rawList = Array.isArray(data.passengers) ? data.passengers : [];
      const next: Passenger[] = rawList
        .map((raw): Passenger | null => {
          const r = raw as Record<string, unknown>;
          const join = String(r.joinStop ?? '').toUpperCase();
          const leave = String(r.leaveStop ?? '').toUpperCase();
          if (!isValidStop(join) || !isValidStop(leave)) return null;
          const ticket: TicketType = r.ticketType === 'Paper' ? 'Paper' : 'eTicket';
          return {
            id: newId(),
            seat: String(r.seat ?? '').toUpperCase().trim(),
            name: String(r.name ?? '').trim(),
            joinStop: join,
            leaveStop: leave,
            ticketType: ticket,
            priority: Boolean(r.priority),
            status: 'expected',
          };
        })
        .filter((p): p is Passenger => p !== null);
      setPassengers(next);
      if (next.length > 0) setReviewIndex(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updatePassenger(id: string, patch: Partial<Passenger>) {
    setPassengers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePassenger(id: string) {
    setPassengers((prev) => prev.filter((p) => p.id !== id));
  }

  function addBlankPassenger() {
    const stops = ROUTES[routeCode].stops;
    setPassengers((prev) => [
      ...prev,
      {
        id: newId(),
        seat: '',
        name: '',
        joinStop: stops[0],
        leaveStop: stops[stops.length - 1],
        ticketType: 'eTicket',
        priority: false,
        status: 'expected',
      },
    ]);
  }

  function startRun() {
    if (passengers.length === 0) {
      setError('No passengers yet. Read a manifest or add one manually.');
      return;
    }
    saveRunState({
      routeCode,
      startedAt: new Date().toISOString(),
      passengers,
      currentStopIndex: 0,
      stopArrivals: {},
    });
    navigate(returnTo || '/cdc/run');
  }

  function discardExisting() {
    if (!confirm('Discard the saved trip in progress?')) return;
    clearRunState();
    setPassengers([]);
  }

  const summary = stopSummary(passengers, routeCode);
  const stopOptions = ROUTES[routeCode].stops;

  const activeStops = useMemo(
    () =>
      stopOptions.filter((s) =>
        passengers.some((p) => p.joinStop === s || p.leaveStop === s),
      ),
    [stopOptions, passengers],
  );
  const reviewing = reviewIndex !== null && activeStops.length > 0;
  const currentReviewStop = reviewing ? activeStops[Math.min(reviewIndex!, activeStops.length - 1)] : null;
  const reviewBoarding = currentReviewStop
    ? passengers.filter((p) => p.joinStop === currentReviewStop)
    : [];
  const reviewAlighting = currentReviewStop
    ? passengers.filter((p) => p.leaveStop === currentReviewStop)
    : [];

  function nextReview() {
    if (reviewIndex === null) return;
    if (reviewIndex >= activeStops.length - 1) {
      setReviewIndex(null);
      return;
    }
    setReviewIndex(reviewIndex + 1);
  }
  function prevReview() {
    if (reviewIndex === null || reviewIndex === 0) return;
    setReviewIndex(reviewIndex - 1);
  }
  function addBoardingHere(stop: StopCode) {
    const stops = ROUTES[routeCode].stops;
    setPassengers((prev) => [
      ...prev,
      {
        id: newId(),
        seat: '',
        name: '',
        joinStop: stop,
        leaveStop: stops[stops.length - 1],
        ticketType: 'eTicket',
        priority: false,
        status: 'expected',
      },
    ]);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black">CDC V/Line Manifest</h1>
        <Link to="/routes" className="text-sm text-blue-400 underline-offset-4 hover:underline">
          ← School routes
        </Link>
      </header>

      {existing && (
        <div className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-200">
          A trip is already in progress ({existing.routeCode}, {existing.passengers.length} pax).{' '}
          <Link to="/cdc/run" className="underline">Resume</Link> or{' '}
          <button type="button" onClick={discardExisting} className="underline">
            discard
          </button>
          .
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!routeQuery && (['C012', 'C011'] as RouteCode[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setRouteCode(code)}
            className={`min-h-touch rounded-2xl px-4 py-3 text-left text-base font-bold ${
              routeCode === code
                ? ROUTE_THEMES[code].solid
                : 'bg-slate-800 text-slate-100 active:bg-slate-700'
            }`}
          >
            <div>{code}</div>
            <div className="text-xs font-medium opacity-80">{ROUTES[code].label.replace(`${code} `, '')}</div>
          </button>
        ))}
        {routeQuery && (
          <div className={`col-span-2 rounded-2xl px-4 py-3 text-base font-bold ${ROUTE_THEMES[routeCode].badge}`}>
            <div>{routeCode}</div>
            <div className="text-xs font-medium opacity-80">
              {ROUTES[routeCode].label.replace(`${routeCode} `, '')}
            </div>
          </div>
        )}
      </div>

      <section className="rounded-2xl bg-slate-800 p-3">
        <h2 className="mb-2 text-base font-bold">Manifest photos ({images.length}/5)</h2>
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-lg bg-slate-900">
              <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/80 px-2 text-xs"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          {images.length < 5 && (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-600 text-3xl text-slate-400">
              +
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void handleFiles(e.target.files)}
                className="hidden"
              />
            </label>
          )}
        </div>
        <button
          type="button"
          onClick={() => void readManifest()}
          disabled={busy || images.length === 0}
          className="btn-primary mt-3"
        >
          {busy ? `Reading ${images.length} photo${images.length === 1 ? '' : 's'}…` : 'Read manifest'}
        </button>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </section>

      {reviewing && currentReviewStop && (
        <section className="rounded-2xl bg-slate-800 p-4">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Review stop {reviewIndex! + 1} of {activeStops.length}
              </p>
              <h2 className="text-3xl font-black leading-tight">{STOP_NAMES[currentReviewStop]}</h2>
            </div>
            <button
              type="button"
              onClick={() => setReviewIndex(null)}
              className="text-xs font-bold text-slate-400 active:text-slate-200"
            >
              Skip review
            </button>
          </div>

          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300">
              Boarding here <CountBadge n={reviewBoarding.length} tone="emerald" />
            </h3>
            {reviewBoarding.length === 0 ? (
              <p className="text-sm text-slate-500">
                No-one boarding at {STOP_NAMES[currentReviewStop]}.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {reviewBoarding.map((p) => (
                  <li key={p.id} className="rounded-xl bg-slate-900 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={p.seat}
                        placeholder="Seat"
                        onChange={(e) =>
                          updatePassenger(p.id, { seat: e.target.value.toUpperCase() })
                        }
                        className="h-9 w-16 rounded-lg bg-slate-800 px-2 text-center font-mono text-sm font-bold text-emerald-300"
                      />
                      <input
                        type="text"
                        value={p.name}
                        placeholder="Name"
                        onChange={(e) => updatePassenger(p.id, { name: e.target.value })}
                        className="h-9 flex-1 rounded-lg bg-slate-800 px-3 text-sm font-bold text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => removePassenger(p.id)}
                        className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 text-red-300 active:bg-slate-700"
                        aria-label="Remove passenger"
                      >
                        ×
                      </button>
                    </div>
                    <select
                      value={p.leaveStop}
                      onChange={(e) =>
                        updatePassenger(p.id, { leaveStop: e.target.value as StopCode })
                      }
                      className="mt-2 h-9 w-full rounded-lg bg-slate-800 px-2 text-xs"
                    >
                      {stopOptions.map((s) => (
                        <option key={s} value={s}>
                          → {STOP_NAMES[s]}
                        </option>
                      ))}
                    </select>
                    <label className="mt-2 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={p.priority}
                        onChange={(e) => updatePassenger(p.id, { priority: e.target.checked })}
                        className="h-4 w-4 accent-amber-400"
                      />
                      Priority boarding
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => addBoardingHere(currentReviewStop)}
              className="mt-3 text-sm font-bold text-blue-300 active:text-blue-200"
            >
              + Add a boarder here
            </button>
          </div>

          {reviewAlighting.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-300">
                Alighting here <CountBadge n={reviewAlighting.length} tone="amber" />
              </h3>
              <ul className="flex flex-col gap-2">
                {reviewAlighting.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2"
                  >
                    <SeatPill seat={p.seat} />
                    <span className="truncate text-sm font-bold text-slate-100">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={prevReview}
              disabled={reviewIndex === 0}
              className="btn-secondary"
            >
              ← Back
            </button>
            <button type="button" onClick={nextReview} className="btn-primary">
              {reviewIndex! >= activeStops.length - 1 ? 'Done — to summary' : 'Next stop →'}
            </button>
          </div>
        </section>
      )}

      {passengers.length > 0 && !reviewing && (
        <section className="rounded-2xl bg-slate-800 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-bold">Passengers ({passengers.length})</h2>
            <button type="button" onClick={addBlankPassenger} className="text-sm text-blue-300 underline">
              + Add manually
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1 pr-2">Seat</th>
                  <th className="py-1 pr-2">Name</th>
                  <th className="py-1 pr-2">Join</th>
                  <th className="py-1 pr-2">Leave</th>
                  <th className="py-1 pr-2">Pri</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {passengers.map((p) => (
                  <tr key={p.id} className="border-t border-slate-700">
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        value={p.seat}
                        onChange={(e) => updatePassenger(p.id, { seat: e.target.value.toUpperCase() })}
                        className="w-14 rounded bg-slate-900 px-2 py-1"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => updatePassenger(p.id, { name: e.target.value })}
                        className="w-full rounded bg-slate-900 px-2 py-1"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={p.joinStop}
                        onChange={(e) => updatePassenger(p.id, { joinStop: e.target.value as StopCode })}
                        className="rounded bg-slate-900 px-2 py-1"
                      >
                        {stopOptions.map((s) => (
                          <option key={s} value={s}>
                            {STOP_NAMES[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={p.leaveStop}
                        onChange={(e) => updatePassenger(p.id, { leaveStop: e.target.value as StopCode })}
                        className="rounded bg-slate-900 px-2 py-1"
                      >
                        {stopOptions.map((s) => (
                          <option key={s} value={s}>
                            {STOP_NAMES[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={p.priority}
                        onChange={(e) => updatePassenger(p.id, { priority: e.target.checked })}
                        className="h-5 w-5"
                      />
                    </td>
                    <td className="py-1">
                      <button
                        type="button"
                        onClick={() => removePassenger(p.id)}
                        className="text-red-300"
                        aria-label="Remove passenger"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {passengers.length > 0 && !reviewing && (
        <section className="rounded-2xl bg-slate-800 p-3">
          <h2 className="mb-2 text-base font-bold">Pickups / dropoffs by stop</h2>
          <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
            {summary
              .filter((s) => s.pickups > 0 || s.dropoffs > 0)
              .map((s) => (
                <li key={s.stop} className="rounded bg-slate-900 px-2 py-1">
                  <span className="font-bold">{STOP_NAMES[s.stop]}</span>
                  <div className="text-xs">
                    <span className="text-emerald-400">+{s.pickups}</span>{' '}
                    <span className="text-amber-400">−{s.dropoffs}</span>
                  </div>
                </li>
              ))}
          </ul>
          {summary.every((s) => s.pickups === 0 && s.dropoffs === 0) && (
            <p className="text-sm text-slate-400">No passengers yet.</p>
          )}
        </section>
      )}

      {!reviewing && (
        <button
          type="button"
          onClick={startRun}
          disabled={passengers.length === 0}
          className="btn-primary"
        >
          {returnTo ? 'Confirm & back to run' : 'Confirm & start run'}
        </button>
      )}

      <details className="rounded-2xl bg-slate-800 p-3 text-sm text-slate-300">
        <summary className="cursor-pointer font-bold">Stops on this route</summary>
        <ol className="mt-2 grid grid-cols-2 gap-1">
          {stopOptions.map((s, i) => (
            <li key={s} className="text-xs">
              <span className="text-slate-500">{i + 1}.</span> {STOP_NAMES[s]}
            </li>
          ))}
        </ol>
      </details>
    </main>
  );
}
