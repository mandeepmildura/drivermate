import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getRouteWithStops, deleteTurnsBetween, insertTurnWaypoints, type TurnDraft } from '../lib/adminRoutes';
import { getSupabase } from '../lib/supabase';
import type { RouteRow, RouteStopRow } from '../lib/db';
import { SaveErrorBanner } from '../components/SaveErrorBanner';

type DirectionsStep = {
  instruction: string;
  lat: number;
  lng: number;
  distance_m: number;
};

type LegState = {
  loading: boolean;
  preview: DirectionsStep[] | null;
  error: string | null;
  saving: boolean;
  deleting: boolean;
};

const blankLeg: LegState = { loading: false, preview: null, error: null, saving: false, deleting: false };

// Fetches turn-by-turn between two coords from the /api/google-directions
// Pages Function. The user's Supabase session token authenticates them as
// admin server-side; the function returns the parsed steps (instruction +
// end-of-step lat/lng).
async function fetchDirections(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<DirectionsStep[]> {
  const { data: sessionData } = await getSupabase().auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Session expired. Please sign in again.');
  const res = await fetch('/api/google-directions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fromLat, fromLng, toLat, toLng }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Directions failed (${res.status})`);
  }
  const data = (await res.json()) as { steps?: DirectionsStep[] };
  return Array.isArray(data.steps) ? data.steps : [];
}

export default function AdminImportTurns() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = useState<RouteRow | null>(null);
  const [stops, setStops] = useState<RouteStopRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [legStates, setLegStates] = useState<Record<string, LegState>>({});

  useEffect(() => {
    if (!routeId) return;
    getRouteWithStops(routeId)
      .then(({ route: r, stops: s }) => {
        setRoute(r);
        setStops(s);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [routeId]);

  // A "leg" is a pair of consecutive stops (regardless of kind). We import
  // turns between consecutive scheduled STOPS specifically — between an
  // existing stop and the next stop in sequence, ignoring any turn rows
  // already in between, since the operator wants directions from origin
  // station to destination station.
  const legs = useMemo(() => {
    const onlyStops = stops.filter((s) => s.kind === 'stop');
    return onlyStops.slice(0, -1).map((from, i) => {
      const to = onlyStops[i + 1];
      const turnsBetween = stops.filter(
        (s) => s.kind === 'turn' && s.sequence > from.sequence && s.sequence < to.sequence,
      );
      return { from, to, turnsBetween };
    });
  }, [stops]);

  function getLeg(key: string): LegState {
    return legStates[key] ?? blankLeg;
  }

  function setLeg(key: string, patch: Partial<LegState>) {
    setLegStates((prev) => ({ ...prev, [key]: { ...(prev[key] ?? blankLeg), ...patch } }));
  }

  async function previewLeg(legKey: string, from: RouteStopRow, to: RouteStopRow) {
    if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
      setLeg(legKey, { error: 'Missing lat/lng on one of the stops.' });
      return;
    }
    setLeg(legKey, { loading: true, error: null, preview: null });
    try {
      const steps = await fetchDirections(from.lat, from.lng, to.lat, to.lng);
      setLeg(legKey, { loading: false, preview: steps });
    } catch (err) {
      setLeg(legKey, { loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function commitLeg(legKey: string, from: RouteStopRow) {
    const state = getLeg(legKey);
    if (!state.preview || state.preview.length === 0 || !routeId) return;
    setLeg(legKey, { saving: true, error: null });
    try {
      const drafts: TurnDraft[] = state.preview.map((s) => ({
        instruction_text: s.instruction,
        lat: s.lat,
        lng: s.lng,
      }));
      await insertTurnWaypoints(routeId, from.sequence, drafts);
      // Reload stops to show the newly inserted turns and the renumbered sequences.
      const fresh = await getRouteWithStops(routeId);
      setStops(fresh.stops);
      setLeg(legKey, { saving: false, preview: null, error: null });
    } catch (err) {
      setLeg(legKey, { saving: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function deleteLegTurns(legKey: string, from: RouteStopRow, to: RouteStopRow, count: number) {
    if (!routeId) return;
    if (!window.confirm(`Delete ${count} turn waypoint${count === 1 ? '' : 's'} between ${from.stop_name} and ${to.stop_name}?`)) return;
    setLeg(legKey, { deleting: true, error: null });
    try {
      await deleteTurnsBetween(routeId, from.sequence, to.sequence);
      const fresh = await getRouteWithStops(routeId);
      setStops(fresh.stops);
      setLeg(legKey, { deleting: false, error: null, preview: null });
    } catch (err) {
      setLeg(legKey, { deleting: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
        <p className="rounded-2xl bg-red-500/15 p-3 text-sm text-red-200">{loadError}</p>
      </main>
    );
  }
  if (!route) {
    return (
      <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
        <p className="text-slate-400">Loading route…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 p-6">
      <button
        type="button"
        onClick={() => navigate(`/admin/${route.id}`)}
        className="self-start rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
      >
        ← Back to route editor
      </button>

      <header>
        <h1 className="text-2xl font-black">{route.route_number} · Import turns from Google Maps</h1>
        <p className="text-sm text-slate-400">
          Inserts turn-by-turn waypoints between consecutive scheduled stops. The route must be
          <span className="font-bold text-emerald-300"> unlocked</span> to edit; lock it again from
          the route editor when you're done.
        </p>
      </header>

      {route.locked && (
        <div className="rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-200">
          This route is currently <strong>locked</strong>. Open the route editor and unlock it
          before importing.{' '}
          <Link to={`/admin/${route.id}`} className="underline">
            Go to route editor
          </Link>
        </div>
      )}

      {legs.length === 0 && (
        <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">
          This route has fewer than 2 scheduled stops, so there's nothing to import between.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {legs.map(({ from, to, turnsBetween }) => {
          const legKey = `${from.id}->${to.id}`;
          const state = getLeg(legKey);
          const canFetch = from.lat != null && from.lng != null && to.lat != null && to.lng != null;
          return (
            <li key={legKey} className="rounded-2xl bg-slate-800 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    Leg {from.sequence} → {to.sequence}
                  </p>
                  <p className="truncate text-base font-bold text-slate-100">
                    {from.stop_name} → {to.stop_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {turnsBetween.length === 0
                      ? 'No turn waypoints in between yet.'
                      : `${turnsBetween.length} turn waypoint${turnsBetween.length === 1 ? '' : 's'} already imported.`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {turnsBetween.length > 0 && (
                    <button
                      type="button"
                      disabled={state.deleting || route.locked}
                      onClick={() => void deleteLegTurns(legKey, from, to, turnsBetween.length)}
                      className="rounded-xl bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 active:bg-red-500/30 disabled:opacity-40"
                      title="Delete imported turns on this leg"
                    >
                      {state.deleting ? 'Deleting…' : `Delete ${turnsBetween.length}`}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={state.loading || route.locked || !canFetch}
                    onClick={() => void previewLeg(legKey, from, to)}
                    className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white active:bg-blue-400 disabled:opacity-40"
                    title={canFetch ? '' : 'Both stops need lat/lng set'}
                  >
                    {state.loading ? 'Fetching…' : 'Preview turns'}
                  </button>
                </div>
              </div>

              {state.error && (
                <div className="mt-3 overflow-hidden rounded-xl">
                  <SaveErrorBanner
                    error={state.error}
                    onDismiss={() => setLeg(legKey, { error: null })}
                  />
                </div>
              )}

              {state.preview && state.preview.length === 0 && (
                <p className="mt-3 text-xs text-slate-400">No turns returned for this leg.</p>
              )}

              {state.preview && state.preview.length > 0 && (
                <div className="mt-3 rounded-xl bg-slate-900/40 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-300">
                    {state.preview.length} turns to insert
                  </p>
                  <ol className="flex flex-col gap-1.5 text-xs text-slate-200">
                    {state.preview.map((s, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="w-6 shrink-0 text-right font-mono text-slate-500">
                          {i + 1}.
                        </span>
                        <span className="min-w-0 flex-1">
                          {s.instruction}
                          <span className="ml-2 text-slate-500">
                            ({(s.distance_m / 1000).toFixed(1)} km)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={state.saving || route.locked}
                      onClick={() => void commitLeg(legKey, from)}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-900 active:bg-emerald-400 disabled:opacity-40"
                    >
                      {state.saving ? 'Saving…' : `Insert ${state.preview.length} turns`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeg(legKey, { preview: null })}
                      className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-slate-300 active:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
