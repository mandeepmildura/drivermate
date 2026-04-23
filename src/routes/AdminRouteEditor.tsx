import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createRoute,
  getRouteWithStops,
  saveStops,
  setRouteLocked,
  updateRoute,
  type RouteDraft,
  type StopDraft,
} from '../lib/adminRoutes';
import type { RouteRow } from '../lib/db';

interface DraftStopRow extends StopDraft {
  _key: string; // stable React key, even before the row gets a server id
}

function blankRow(sequence: number, kind: 'stop' | 'turn' = 'stop'): DraftStopRow {
  return {
    _key: crypto.randomUUID(),
    sequence,
    kind,
    stop_name: '',
    scheduled_time: null,
    instruction_text: null,
    instruction_audio_cue: null,
    lat: null,
    lng: null,
  };
}

const blankRoute: RouteDraft = {
  route_number: '',
  display_number: null,
  description: null,
  active: true,
  locked: false,
};

export default function AdminRouteEditor() {
  const { routeId } = useParams<{ routeId: string }>();
  const isNew = !routeId;
  const navigate = useNavigate();

  const [route, setRoute] = useState<RouteDraft>(blankRoute);
  const [serverRoute, setServerRoute] = useState<RouteRow | null>(null);
  const [stops, setStops] = useState<DraftStopRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getRouteWithStops(routeId!)
      .then(({ route: r, stops: s }) => {
        setServerRoute(r);
        setRoute({
          route_number: r.route_number,
          display_number: r.display_number,
          description: r.description,
          active: r.active,
          locked: r.locked,
        });
        setStops(
          s.map((stop) => ({
            _key: stop.id,
            id: stop.id,
            sequence: stop.sequence,
            kind: stop.kind,
            stop_name: stop.stop_name,
            scheduled_time: stop.scheduled_time,
            instruction_text: stop.instruction_text,
            instruction_audio_cue: stop.instruction_audio_cue,
            lat: stop.lat,
            lng: stop.lng,
          })),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [routeId, isNew]);

  const locked = serverRoute?.locked ?? route.locked;
  const editable = !locked || isNew;

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  function patchRoute(patch: Partial<RouteDraft>) {
    setRoute((prev) => ({ ...prev, ...patch }));
  }

  function patchStop(key: string, patch: Partial<StopDraft>) {
    setStops((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }

  function addRow(kind: 'stop' | 'turn') {
    const nextSeq = stops.length === 0 ? 1 : Math.max(...stops.map((s) => s.sequence)) + 1;
    setStops((prev) => [...prev, blankRow(nextSeq, kind)]);
  }

  function removeStop(key: string) {
    setStops((prev) => {
      const target = prev.find((s) => s._key === key);
      if (target?.id) setRemoved((r) => [...r, target.id!]);
      return prev.filter((s) => s._key !== key);
    });
  }

  async function toggleLocked() {
    if (!serverRoute) return;
    const next = !serverRoute.locked;
    try {
      await setRouteLocked(serverRoute.id, next);
      setServerRoute({ ...serverRoute, locked: next });
      setRoute((prev) => ({ ...prev, locked: next }));
      setInfo(next ? 'Route locked. Drivers see this version until unlocked.' : 'Route unlocked for editing.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function save() {
    setError(null);
    setInfo(null);
    if (!route.route_number.trim()) {
      setError('Route number is required.');
      return;
    }
    setSaving(true);
    try {
      const persistedRoute = isNew
        ? await createRoute(route)
        : await updateRoute(routeId!, route);

      await saveStops(persistedRoute.id, stops, removed);
      setRemoved([]);
      setServerRoute(persistedRoute);
      setInfo('Saved.');
      if (isNew) navigate(`/admin/${persistedRoute.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">
        Loading route…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <Link to="/admin" className="text-sm text-slate-400 hover:underline">
          &larr; All routes
        </Link>
        {!isNew && serverRoute && (
          <button
            type="button"
            onClick={toggleLocked}
            className={`rounded-full px-4 py-2 text-sm font-bold uppercase tracking-widest ${
              serverRoute.locked
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-amber-500/20 text-amber-200'
            }`}
          >
            {serverRoute.locked ? 'Unlock' : 'Lock route'}
          </button>
        )}
      </header>

      <h1 className="text-3xl font-black">
        {isNew ? 'New route' : `Edit ${route.route_number || 'route'}`}
      </h1>

      {locked && !isNew && (
        <p className="rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-200">
          This route is locked. Unlock it to edit. Drivers continue to see the locked version.
        </p>
      )}

      {error && <p className="rounded-2xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}
      {info && <p className="rounded-2xl bg-emerald-500/15 p-3 text-sm text-emerald-200">{info}</p>}

      <section className="grid grid-cols-2 gap-3 rounded-3xl bg-slate-800 p-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="uppercase tracking-widest text-slate-400">Route number</span>
          <input
            type="text"
            value={route.route_number}
            onChange={(e) => patchRoute({ route_number: e.target.value })}
            disabled={!editable}
            className="rounded-xl bg-slate-900 px-3 py-2 text-lg disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="uppercase tracking-widest text-slate-400">Bus display number</span>
          <input
            type="text"
            value={route.display_number ?? ''}
            onChange={(e) => patchRoute({ display_number: e.target.value || null })}
            disabled={!editable}
            className="rounded-xl bg-slate-900 px-3 py-2 text-lg disabled:opacity-50"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="uppercase tracking-widest text-slate-400">Description</span>
          <input
            type="text"
            value={route.description ?? ''}
            onChange={(e) => patchRoute({ description: e.target.value || null })}
            disabled={!editable}
            className="rounded-xl bg-slate-900 px-3 py-2 text-lg disabled:opacity-50"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={route.active}
            onChange={(e) => patchRoute({ active: e.target.checked })}
            disabled={!editable}
            className="h-5 w-5"
          />
          Active (drivers can pick this route)
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-slate-800 p-5">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Stops &amp; turns</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addRow('turn')}
              disabled={!editable}
              className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold disabled:opacity-50"
            >
              + Turn
            </button>
            <button
              type="button"
              onClick={() => addRow('stop')}
              disabled={!editable}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold disabled:opacity-50"
            >
              + Stop
            </button>
          </div>
        </header>

        {sortedStops.length === 0 ? (
          <p className="text-sm text-slate-400">No stops yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sortedStops.map((stop) => (
              <li
                key={stop._key}
                className={`rounded-2xl p-3 ${
                  stop.kind === 'turn' ? 'bg-slate-900/60 ring-1 ring-slate-700' : 'bg-slate-900'
                }`}
              >
                <div className="grid grid-cols-6 gap-2">
                  <label className="col-span-1 flex flex-col gap-1 text-xs">
                    <span className="uppercase tracking-widest text-slate-500">Seq</span>
                    <input
                      type="number"
                      min={1}
                      value={stop.sequence}
                      onChange={(e) =>
                        patchStop(stop._key, { sequence: Number(e.target.value) || 1 })
                      }
                      disabled={!editable}
                      className="rounded-lg bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="col-span-1 flex flex-col gap-1 text-xs">
                    <span className="uppercase tracking-widest text-slate-500">Kind</span>
                    <select
                      value={stop.kind}
                      onChange={(e) =>
                        patchStop(stop._key, { kind: e.target.value as 'stop' | 'turn' })
                      }
                      disabled={!editable}
                      className="rounded-lg bg-slate-800 px-2 py-1"
                    >
                      <option value="stop">Stop</option>
                      <option value="turn">Turn</option>
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-xs">
                    <span className="uppercase tracking-widest text-slate-500">
                      {stop.kind === 'turn' ? 'Turn description' : 'Stop name'}
                    </span>
                    <input
                      type="text"
                      value={stop.stop_name}
                      onChange={(e) => patchStop(stop._key, { stop_name: e.target.value })}
                      placeholder={
                        stop.kind === 'turn'
                          ? 'Left into Bathurst Court'
                          : 'St Joseph\u2019s College'
                      }
                      disabled={!editable}
                      className="rounded-lg bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-xs">
                    <span className="uppercase tracking-widest text-slate-500">
                      {stop.kind === 'turn' ? 'Time (optional)' : 'Time'}
                    </span>
                    <input
                      type="time"
                      value={stop.scheduled_time?.slice(0, 5) ?? ''}
                      onChange={(e) =>
                        patchStop(stop._key, {
                          scheduled_time: e.target.value ? `${e.target.value}:00` : null,
                        })
                      }
                      disabled={!editable}
                      className="rounded-lg bg-slate-800 px-2 py-1"
                    />
                  </label>
                </div>
                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="uppercase tracking-widest text-slate-500">
                    Instruction (shown on screen)
                  </span>
                  <input
                    type="text"
                    value={stop.instruction_text ?? ''}
                    onChange={(e) =>
                      patchStop(stop._key, { instruction_text: e.target.value || null })
                    }
                    placeholder="Turn LEFT into Eleventh Street"
                    disabled={!editable}
                    className="rounded-lg bg-slate-800 px-2 py-1"
                  />
                </label>
                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="uppercase tracking-widest text-slate-500">
                    Audio cue (optional, what gets spoken)
                  </span>
                  <input
                    type="text"
                    value={stop.instruction_audio_cue ?? ''}
                    onChange={(e) =>
                      patchStop(stop._key, { instruction_audio_cue: e.target.value || null })
                    }
                    placeholder="Defaults to the instruction text"
                    disabled={!editable}
                    className="rounded-lg bg-slate-800 px-2 py-1"
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="uppercase tracking-widest text-slate-500">
                      Latitude (GPS auto-advance)
                    </span>
                    <input
                      type="number"
                      step="0.00001"
                      value={stop.lat ?? ''}
                      onChange={(e) =>
                        patchStop(stop._key, {
                          lat: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      placeholder="-34.18935"
                      disabled={!editable}
                      className="rounded-lg bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="uppercase tracking-widest text-slate-500">Longitude</span>
                    <input
                      type="number"
                      step="0.00001"
                      value={stop.lng ?? ''}
                      onChange={(e) =>
                        patchStop(stop._key, {
                          lng: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      placeholder="142.15803"
                      disabled={!editable}
                      className="rounded-lg bg-slate-800 px-2 py-1"
                    />
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tip: right-click the stop in Google Maps → &ldquo;What&rsquo;s here?&rdquo; to copy the coordinates.
                </p>
                <button
                  type="button"
                  onClick={() => removeStop(stop._key)}
                  disabled={!editable}
                  className="mt-2 text-xs uppercase tracking-widest text-red-300 disabled:opacity-50"
                >
                  Remove stop
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={save} disabled={!editable || saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save route'}
      </button>
    </main>
  );
}
