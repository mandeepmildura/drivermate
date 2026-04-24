import * as turf from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import type { RouteStopRow } from './db';

export function buildRouteLine(
  stops: RouteStopRow[],
): Feature<LineString> | null {
  const coords = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => [s.lng!, s.lat!] as [number, number]);
  if (coords.length < 2) return null;
  return turf.lineString(coords);
}

export function distanceAlongRouteToIndex(
  busLat: number,
  busLng: number,
  stops: RouteStopRow[],
  targetIndex: number,
): number | null {
  const line = buildRouteLine(stops);
  if (!line) return null;
  const target = stops[targetIndex];
  if (!target || target.lat == null || target.lng == null) return null;

  const busPoint = turf.point([busLng, busLat]);
  const targetPoint = turf.point([target.lng, target.lat]);

  const snappedBus = turf.nearestPointOnLine(line, busPoint, { units: 'meters' });
  const snappedTarget = turf.nearestPointOnLine(line, targetPoint, { units: 'meters' });

  const busLocation = snappedBus.properties.location ?? 0;
  const targetLocation = snappedTarget.properties.location ?? 0;

  const remaining = targetLocation - busLocation;
  return Math.max(0, remaining);
}

export function directionFromInstruction(text: string | null): '←' | '→' | '↑' {
  if (!text) return '↑';
  const lower = text.toLowerCase();
  if (lower.includes('left')) return '←';
  if (lower.includes('right')) return '→';
  return '↑';
}
