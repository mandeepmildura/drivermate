import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Feature, LineString, Point } from 'geojson';
import type { RouteStopRow } from '../lib/db';
import { haversineMetres } from '../lib/geo';

// Bearing derived from two coordinates, in degrees clockwise from true north.
// Used as a fallback when the GPS fix (or simulator) doesn't supply heading.
function bearingBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const MILDURA_CENTER: [number, number] = [142.1328, -34.1836];

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

interface Props {
  stops: RouteStopRow[];
  busLat: number | null;
  busLng: number | null;
  busHeading: number | null;
  currentStopIndex: number;
  pathGeoJson?: object | null;
  className?: string;
}

function buildRouteLineData(stops: RouteStopRow[], pathGeoJson?: object | null): Feature<LineString> {
  // Prefer admin-drawn path_geojson over straight-line fallback
  if (pathGeoJson) {
    const f = pathGeoJson as Feature<LineString>;
    if (f?.geometry?.type === 'LineString') return f;
  }
  const coords = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => [s.lng!, s.lat!] as [number, number]);
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords.length >= 2 ? coords : [] },
  };
}

function buildStopsData(stops: RouteStopRow[], currentIndex: number): FeatureCollection {
  const features: Feature<Point>[] = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s, i) => ({
      type: 'Feature',
      properties: {
        kind: s.kind,
        name: s.stop_name,
        isCurrent: i === currentIndex,
      },
      geometry: { type: 'Point', coordinates: [s.lng!, s.lat!] },
    }));
  return { type: 'FeatureCollection', features };
}

const BUS_SVG = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="16,3 28,26 16,21 4,26" fill="#facc15" stroke="#0f172a" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

export default function RouteMap({
  stops,
  busLat,
  busLng,
  busHeading,
  currentStopIndex,
  pathGeoJson,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const busElRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);
  // Last position we placed the bus at, used to derive a heading when the
  // GPS fix (or the dev simulator) doesn't carry one — without this the map
  // bearing stays at 0 and never rotates as the bus turns.
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastBearingRef = useRef<number>(0);

  const stopsWithCoords = useMemo(
    () => stops.filter((s) => s.lat != null && s.lng != null),
    [stops],
  );

  const initialCenter: [number, number] =
    stopsWithCoords.length > 0
      ? [stopsWithCoords[0].lng!, stopsWithCoords[0].lat!]
      : MILDURA_CENTER;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: initialCenter,
      zoom: 15,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.touchZoomRotate.disableRotation();

    const busEl = document.createElement('div');
    busEl.style.cssText = 'width:32px;height:32px;transform-origin:center center;';
    busEl.innerHTML = BUS_SVG;
    busElRef.current = busEl;

    const busMarker = new maplibregl.Marker({ element: busEl, anchor: 'center' });
    busMarkerRef.current = busMarker;

    map.on('load', () => {
      loadedRef.current = true;
      map.resize();

      map.addSource('route-line', {
        type: 'geojson',
        data: buildRouteLineData(stops, pathGeoJson),
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

      map.addSource('stops', {
        type: 'geojson',
        data: buildStopsData(stopsWithCoords, currentStopIndex),
      });
      map.addLayer({
        id: 'stop-circles',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'isCurrent'], true], 10,
            ['==', ['get', 'kind'], 'stop'], 7,
            5,
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'isCurrent'], true], '#ffffff',
            ['==', ['get', 'kind'], 'stop'], '#10b981',
            '#f59e0b',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
        },
      });

      if (busLat != null && busLng != null) {
        busMarker.setLngLat([busLng, busLat]).addTo(map);
      }
    });

    mapRef.current = map;
    return () => {
      loadedRef.current = false;
      busMarkerRef.current = null;
      busElRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loadedRef.current || !mapRef.current) return;
    const map = mapRef.current;
    (map.getSource('route-line') as maplibregl.GeoJSONSource | undefined)?.setData(
      buildRouteLineData(stops, pathGeoJson),
    );
    (map.getSource('stops') as maplibregl.GeoJSONSource | undefined)?.setData(
      buildStopsData(stopsWithCoords, currentStopIndex),
    );
  }, [stops, stopsWithCoords, currentStopIndex, pathGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = busMarkerRef.current;
    if (!map || !marker || busLat == null || busLng == null) return;

    marker.setLngLat([busLng, busLat]);
    if (!marker.getElement().parentNode) {
      marker.addTo(map);
    }

    // Pick the bearing to use for the camera. Real GPS often returns
    // heading: null at low speed, and the dev simulator never sets one,
    // so we fall back to the bearing between successive fixes (only once
    // we've moved far enough to be meaningful — ~5 m). Otherwise the map
    // would freeze pointing at whatever bearing it last had.
    let bearing = lastBearingRef.current;
    if (busHeading != null && Number.isFinite(busHeading)) {
      bearing = busHeading;
    } else if (lastPosRef.current) {
      const moved = haversineMetres(
        lastPosRef.current.lat,
        lastPosRef.current.lng,
        busLat,
        busLng,
      );
      if (moved >= 5) {
        bearing = bearingBetween(
          lastPosRef.current.lat,
          lastPosRef.current.lng,
          busLat,
          busLng,
        );
      }
    }
    lastBearingRef.current = bearing;
    lastPosRef.current = { lat: busLat, lng: busLng };

    if (loadedRef.current) {
      map.easeTo({ center: [busLng, busLat], bearing, duration: 800 });
    }
  }, [busLat, busLng, busHeading]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}
