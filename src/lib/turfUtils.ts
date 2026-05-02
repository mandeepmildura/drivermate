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

// True when the bus has driven past the target waypoint along the route line
// by more than `toleranceM` metres. Snapping is done on a local 2-segment
// window (prev → target → next) so self-intersecting routes don't snap to the
// wrong leg. Used as a fallback to the 50m geofence: drivers blow past
// request-stops at speed (no kids waiting → no 8 s dwell), and turn waypoints
// picked from satellite imagery can sit 60+ m off the road.
//
// The perpendicular-distance guard rejects matches where the bus is far from
// the local window's straight-line geometry — i.e. the bus is on a road that
// curves outside the prev→target→next chord. Without it, perpendicular
// projection onto the chord can land past `target` while the bus is still
// physically far short of it, causing the run banner to advance early.
const SEGMENT_PROXIMITY_M = 100;

export function hasPassedWaypoint(
  busLat: number,
  busLng: number,
  stops: RouteStopRow[],
  targetIndex: number,
  toleranceM = 20,
): boolean {
  const target = stops[targetIndex];
  if (!target || target.lat == null || target.lng == null) return false;

  const startIdx = Math.max(0, targetIndex - 1);
  const endIdx = Math.min(stops.length - 1, targetIndex + 1);
  const window = stops.slice(startIdx, endIdx + 1);
  const line = buildRouteLine(window);
  if (!line) return false;

  const busPoint = turf.point([busLng, busLat]);
  const targetPoint = turf.point([target.lng, target.lat]);

  const snappedBus = turf.nearestPointOnLine(line, busPoint, { units: 'meters' });
  const snappedTarget = turf.nearestPointOnLine(line, targetPoint, { units: 'meters' });

  const busSnapDistanceM = snappedBus.properties.dist ?? Number.POSITIVE_INFINITY;
  if (busSnapDistanceM > SEGMENT_PROXIMITY_M) return false;

  const busLocation = snappedBus.properties.location ?? 0;
  const targetLocation = snappedTarget.properties.location ?? 0;

  return busLocation - targetLocation > toleranceM;
}

export function directionFromInstruction(text: string | null): '←' | '→' | '↑' {
  if (!text) return '↑';
  const lower = text.toLowerCase();
  if (lower.includes('left')) return '←';
  if (lower.includes('right')) return '→';
  return '↑';
}

// "Bare" turn instructions — e.g. "Turn left", "Slight right" — give a new
// driver no road or landmark to anchor on. When the next scheduled stop is
// known, append " — toward <stop name>" so the spoken cue and banner read as
// "Turn left — toward Swan Hill Station". Returns the input unchanged when
// the instruction already contains a road reference, or when there's no next
// stop to point at.
const BARE_TURN_RE =
  /^(turn (left|right|around)|slight (left|right)|sharp (left|right)|make a u-?turn|head (north|south|east|west|north[\s-]?east|north[\s-]?west|south[\s-]?east|south[\s-]?west))\.?$/i;

export function enrichBareTurnText(
  instruction: string | null | undefined,
  nextStopName: string | null | undefined,
): string | null {
  if (!instruction) return instruction ?? null;
  if (!nextStopName) return instruction;
  if (!BARE_TURN_RE.test(instruction.trim())) return instruction;
  return `${instruction.trim()} — toward ${nextStopName}`;
}
