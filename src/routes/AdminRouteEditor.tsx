import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
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

type EditorMode = 'select' | 'draw' | 'add-stop' | 'add-turn';

interface DraftStop extends StopDraft {
  _key: string;
}

const MILDURA: [number, number] = [142.1328, -34.1836];

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
};

function blankStop(seq: number, lat: number, lng: number, kind: 'stop' | 'turn'): DraftStop {
  return {
    _key: crypto.randomUUID(),
    sequence: seq,
    kind,
    stop_name: kind === 'turn' ? '' : '',
    scheduled_time: null,
    instruction_text: null,
    instruction_audio_cue: null,
    lat,
    lng,
  };
}

function buildLineData(coords: [number, number][]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords.length >= 2 ? coords : [] },
  };
}

function buildStopsData(stops: DraftStop[], selectedKey: string | null): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        type: 'Feature',
        properties: { key: s._key, kind: s.kind, selected: s._key === selectedKey },
        geometry: { type: 'Point', coordinates: [s.lng!, s.lat!] },
      })),
  };
}

const blankRoute: RouteDraft = {
  route_number: '',
  display_number: null,
  description: null,
  active: true,
  locked: false,
  service_type: 'school',
  path_geojson: null,
};

export default function AdminRouteEditor() {
  const { routeId } = useParams<{ routeId: string }>();
  const isNew = !routeId;
  const navigate = useNavigate();

  // Route metadata
  const [route, setRoute] = useState<RouteDraft>(blankRoute);
  const [serverRoute, setServerRoute] = useState<RouteRow | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Stops
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Path line
  const [pathCoords, setPathCoords] = useState<[number, number][]>([]);

  // Editor mode
  const [mode, setMode] = useState<EditorMode>('select');
  const modeRef = useRef<EditorMode>('select');
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Map refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Refs for state inside map callbacks
  const stopsRef = useRef<DraftStop[]>([]);
  const selectedKeyRef = useRef<string | null>(null);
  const pathCoordsRef = useRef<[number, number][]>([]);
  useEffect(() => { stopsRef.current = stops; }, [stops]);
  useEffect(() => { selectedKeyRef.current = selectedKey; }, [selectedKey]);
  useEffect(() => { pathCoordsRef.current = pathCoords; }, [pathCoords]);

  const locked = serverRoute?.locked ?? route.locked;
  const editable = !locked || isNew;

  const selectedStop = useMemo(
    () => stops.find((s) => s._key === selectedKey) ?? null,
    [stops, selectedKey],
  );

  // Load existing route
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
          service_type: r.service_type,
          path_geojson: (r.path_geojson as RouteDraft['path_geojson']) ?? null,
        });
        const loaded = s.map((stop) => ({
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
        }));
        setStops(loaded);

        // Parse stored path_geojson into coords
        if (r.path_geojson) {
          const f = r.path_geojson as Feature<LineString>;
          if (f?.geometry?.type === 'LineString') {
            setPathCoords(f.geometry.coordinates as [number, number][]);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [routeId, isNew]);

  // Patch helpers
  function patchRoute(patch: Partial<RouteDraft>) {
    setRoute((prev) => ({ ...prev, ...patch }));
  }

  function patchStop(key: string, patch: Partial<StopDraft>) {
    setStops((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }

  function removeStop(key: string) {
    setStops((prev) => {
      const target = prev.find((s) => s._key === key);
      if (target?.id) setRemoved((r) => [...r, target.id!]);
      return prev.filter((s) => s._key !== key);
    });
    if (selectedKey === key) setSelectedKey(null);
  }

  // ── Map initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: MILDURA,
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      loadedRef.current = true;
      map.resize();

      // Route line
      map.addSource('route-line', {
        type: 'geojson',
        data: buildLineData(pathCoordsRef.current),
      });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0f172a', 'line-width': 10 },
      });
      map.addLayer({
        id: 'route-fill',
        type: 'line',
        source: 'route-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 6 },
      });

      // Stops layer (circles only — markers handle interaction)
      map.addSource('stops-bg', {
        type: 'geojson',
        data: buildStopsData(stopsRef.current, selectedKeyRef.current),
      });
      map.addLayer({
        id: 'stops-bg-circles',
        type: 'circle',
        source: 'stops-bg',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], true], 12, 8],
          'circle-color': ['case', ['==', ['get', 'kind'], 'stop'], '#10b981', '#f59e0b'],
          'circle-stroke-width': 3,
          'circle-stroke-color': ['case', ['==', ['get', 'selected'], true], '#fff', '#0f172a'],
          'circle-opacity': 0.3,
        },
      });

      // Map click handler
      map.on('click', (e) => {
        const m = modeRef.current;
        if (m === 'draw') {
          const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          setPathCoords((prev) => [...prev, coord]);
        } else if (m === 'add-stop' || m === 'add-turn') {
          const current = stopsRef.current;
          const nextSeq = current.length === 0 ? 1 : Math.max(...current.map((s) => s.sequence)) + 1;
          const kind: 'stop' | 'turn' = m === 'add-stop' ? 'stop' : 'turn';
          const newStop = blankStop(nextSeq, e.lngLat.lat, e.lngLat.lng, kind);
          setStops((prev) => [...prev, newStop]);
          setSelectedKey(newStop._key);
          setMode('select');
        }
      });

      // Fit to existing stops if any
      const existing = stopsRef.current.filter((s) => s.lat != null && s.lng != null);
      if (existing.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        existing.forEach((s) => bounds.extend([s.lng!, s.lat!]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
      }
    });

    mapRef.current = map;
    return () => {
      loadedRef.current = false;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync route line to map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !mapRef.current) return;
    (mapRef.current.getSource('route-line') as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildLineData(pathCoords));
  }, [pathCoords]);

  // ── Sync stops circles to map ──────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !mapRef.current) return;
    (mapRef.current.getSource('stops-bg') as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildStopsData(stops, selectedKey));
  }, [stops, selectedKey]);

  // ── Sync draggable markers ─────────────────────────────────────────────────
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const currentKeys = new Set(stops.filter((s) => s.lat != null).map((s) => s._key));

    // Remove stale markers
    markersRef.current.forEach((marker, key) => {
      if (!currentKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    });

    // Add/update markers
    stops.forEach((stop) => {
      if (stop.lat == null || stop.lng == null) return;
      const existing = markersRef.current.get(stop._key);
      if (existing) {
        existing.setLngLat([stop.lng, stop.lat]);
        return;
      }

      const el = document.createElement('div');
      el.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background: ${stop.kind === 'stop' ? '#10b981' : '#f59e0b'};
        border: 3px solid #0f172a; cursor: pointer;
      `;

      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        patchStop(stop._key, { lat: ll.lat, lng: ll.lng });
      });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedKey(stop._key);
        setMode('select');
      });

      markersRef.current.set(stop._key, marker);
    });
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncMarkers();
  }, [syncMarkers]);

  // ── Cursor style based on mode ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = mode === 'select' ? '' : 'crosshair';
  }, [mode]);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save() {
    setError(null);
    setInfo(null);
    if (!route.route_number.trim()) {
      setError('Route number is required.');
      return;
    }
    setSaving(true);
    try {
      const geojsonLine: Feature<LineString> | null =
        pathCoords.length >= 2
          ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pathCoords } }
          : null;

      const draft: RouteDraft = {
        ...route,
        path_geojson: geojsonLine as RouteDraft['path_geojson'],
      };
      const persisted = isNew ? await createRoute(draft) : await updateRoute(routeId!, draft);
      await saveStops(persisted.id, stops, removed);
      setRemoved([]);
      setServerRoute(persisted);
      setInfo('Saved.');
      if (isNew) navigate(`/admin/${persisted.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleLocked() {
    if (!serverRoute) return;
    const next = !serverRoute.locked;
    try {
      await setRouteLocked(serverRoute.id, next);
      setServerRoute({ ...serverRoute, locked: next });
      setRoute((prev) => ({ ...prev, locked: next }));
      setInfo(next ? 'Route locked — drivers see this version.' : 'Route unlocked for editing.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center text-slate-400">Loading…</main>
    );
  }

  const modeBtn = (m: EditorMode, label: string, title: string, activeClass: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); if (m !== 'add-stop' && m !== 'add-turn') setSelectedKey(null); }}
      disabled={!editable}
      title={title}
      className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-40 ${
        mode === m ? activeClass : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex h-full flex-col bg-slate-900 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-700 bg-slate-900">
        <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-200">
          ← All routes
        </Link>
        <span className="font-bold text-sm truncate">
          {isNew ? 'New route' : (route.route_number || 'Edit route')}
        </span>
        <div className="flex gap-2 shrink-0">
          {!isNew && serverRoute && (
            <button
              type="button"
              onClick={toggleLocked}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                serverRoute.locked
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-amber-500/20 text-amber-200'
              }`}
            >
              {serverRoute.locked ? 'Unlock' : 'Lock'}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || !editable}
            className="rounded-full bg-blue-500 px-4 py-1 text-sm font-bold text-white active:bg-blue-400 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 overflow-x-auto">
        {modeBtn('select', 'Select', 'Click a marker to edit it', 'bg-blue-500 text-white')}
        {modeBtn('draw', 'Draw line', 'Click on map to trace the route', 'bg-blue-500 text-white')}
        {modeBtn('add-stop', '+ Stop', 'Click on map to place a scheduled stop', 'bg-emerald-600 text-white')}
        {modeBtn('add-turn', '+ Turn', 'Click on map to place a turn waypoint', 'bg-amber-500 text-slate-900')}
        <div className="ml-auto flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPathCoords((p) => p.slice(0, -1))}
            disabled={!editable || pathCoords.length === 0}
            className="rounded-xl bg-slate-700 px-3 py-1.5 text-sm disabled:opacity-40"
            title="Undo last route point"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => { if (confirm('Clear the entire route line?')) setPathCoords([]); }}
            disabled={!editable || pathCoords.length === 0}
            className="rounded-xl bg-slate-700 px-3 py-1.5 text-sm text-red-300 disabled:opacity-40"
            title="Clear route line"
          >
            Clear line
          </button>
        </div>
      </div>

      {/* ── Notifications ──────────────────────────────────────────────── */}
      {locked && !isNew && (
        <div className="shrink-0 px-4 py-2 bg-amber-500/10 text-amber-200 text-xs border-b border-amber-500/20">
          Route is locked — unlock to edit.
        </div>
      )}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-500/10 text-red-200 text-xs border-b border-red-500/20">
          {error}
        </div>
      )}
      {info && (
        <div className="shrink-0 px-4 py-2 bg-emerald-500/10 text-emerald-200 text-xs border-b border-emerald-500/20">
          {info}
        </div>
      )}

      {/* ── Mode hint ──────────────────────────────────────────────────── */}
      {mode !== 'select' && (
        <div className="shrink-0 px-4 py-1.5 bg-blue-500/10 text-blue-200 text-xs border-b border-blue-500/20 text-center">
          {mode === 'draw' && 'Click on the map to trace the route line. Use Undo to remove the last point.'}
          {mode === 'add-stop' && 'Click on the map to place a scheduled stop (school, formal pickup).'}
          {mode === 'add-turn' && 'Click on the map to place a turn waypoint.'}
        </div>
      )}

      {/* ── Map + panel ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Map — explicit 50vh on mobile so it never collapses on Safari */}
        <div className="h-[50vh] lg:h-auto lg:flex-1 min-w-0">
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Side panel */}
        <div className="flex-1 lg:flex-none lg:w-80 flex flex-col gap-0 border-t lg:border-t-0 lg:border-l border-slate-700 overflow-y-auto bg-slate-900">

          {/* Route metadata */}
          <div className="p-4 border-b border-slate-700">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Route details</p>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Route number</span>
                <input
                  type="text"
                  value={route.route_number}
                  onChange={(e) => patchRoute({ route_number: e.target.value })}
                  disabled={!editable}
                  placeholder="715102"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Display number</span>
                <input
                  type="text"
                  value={route.display_number ?? ''}
                  onChange={(e) => patchRoute({ display_number: e.target.value || null })}
                  disabled={!editable}
                  placeholder="712"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Description</span>
                <input
                  type="text"
                  value={route.description ?? ''}
                  onChange={(e) => patchRoute({ description: e.target.value || null })}
                  disabled={!editable}
                  placeholder="AM run"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Service type</span>
                <select
                  value={route.service_type}
                  onChange={(e) => patchRoute({ service_type: e.target.value as RouteDraft['service_type'] })}
                  disabled={!editable}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="school">School</option>
                  <option value="vline">V/Line coach</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={route.active}
                  onChange={(e) => patchRoute({ active: e.target.checked })}
                  disabled={!editable}
                  className="h-4 w-4"
                />
                Active (drivers can pick this route)
              </label>
            </div>
          </div>

          {/* Selected stop editor */}
          {selectedStop ? (
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  {selectedStop.kind === 'turn' ? 'Turn waypoint' : 'Scheduled stop'}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="text-slate-500 text-xs hover:text-slate-300"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2">
                {(['stop', 'turn'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => patchStop(selectedStop._key, { kind: k })}
                    disabled={!editable}
                    className={`flex-1 rounded-lg py-1 text-xs font-bold disabled:opacity-50 ${
                      selectedStop.kind === k
                        ? k === 'stop' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-900'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {k === 'stop' ? 'Stop' : 'Turn'}
                  </button>
                ))}
              </div>

              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">{selectedStop.kind === 'turn' ? 'Label' : 'Stop name'}</span>
                <input
                  type="text"
                  value={selectedStop.stop_name}
                  onChange={(e) => patchStop(selectedStop._key, { stop_name: e.target.value })}
                  disabled={!editable}
                  placeholder={selectedStop.kind === 'turn' ? 'Eleventh St & Deakin Ave' : "St Joseph's College"}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                  autoFocus
                />
              </label>

              {selectedStop.kind === 'stop' && (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-slate-400">Scheduled time</span>
                  <input
                    type="time"
                    value={selectedStop.scheduled_time?.slice(0, 5) ?? ''}
                    onChange={(e) =>
                      patchStop(selectedStop._key, {
                        scheduled_time: e.target.value ? `${e.target.value}:00` : null,
                      })
                    }
                    disabled={!editable}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Instruction (shown on screen)</span>
                <input
                  type="text"
                  value={selectedStop.instruction_text ?? ''}
                  onChange={(e) =>
                    patchStop(selectedStop._key, { instruction_text: e.target.value || null })
                  }
                  disabled={!editable}
                  placeholder="Turn LEFT into Eleventh Street"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Audio cue (spoken aloud)</span>
                <input
                  type="text"
                  value={selectedStop.instruction_audio_cue ?? ''}
                  onChange={(e) =>
                    patchStop(selectedStop._key, { instruction_audio_cue: e.target.value || null })
                  }
                  disabled={!editable}
                  placeholder="Defaults to instruction text"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Sequence</span>
                <input
                  type="number"
                  min={1}
                  value={selectedStop.sequence}
                  onChange={(e) =>
                    patchStop(selectedStop._key, { sequence: Number(e.target.value) || 1 })
                  }
                  disabled={!editable}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>

              <div className="pt-1 text-xs text-slate-500">
                Lat: {selectedStop.lat?.toFixed(6)} · Lng: {selectedStop.lng?.toFixed(6)}
                <br />Drag the marker on the map to reposition.
              </div>

              <button
                type="button"
                onClick={() => removeStop(selectedStop._key)}
                disabled={!editable}
                className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-300 font-bold disabled:opacity-50"
              >
                Delete this {selectedStop.kind}
              </button>
            </div>
          ) : (
            <div className="p-4 text-xs text-slate-500">
              <p className="font-semibold text-slate-400 mb-2">
                {stops.length} waypoint{stops.length !== 1 ? 's' : ''}
                {pathCoords.length > 0 ? ` · ${pathCoords.length}-point route line` : ' · No route line drawn'}
              </p>
              <p>Use the toolbar to:</p>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li><strong>Draw line</strong> — trace the road</li>
                <li><strong>+ Stop</strong> — place a school or formal pickup</li>
                <li><strong>+ Turn</strong> — place a navigation waypoint</li>
                <li><strong>Select</strong> — click a marker to edit it</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
