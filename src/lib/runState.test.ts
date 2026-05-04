import { describe, expect, it } from 'vitest';
import {
  coerceFiniteOrNull,
  decideDropoutPrompt,
  isDuplicateStopLog,
  isInGpsGap,
} from './runState';
import { haversineMetres } from './geo';

describe('isDuplicateStopLog', () => {
  it('returns true when the current stop id matches the last-logged id', () => {
    expect(isDuplicateStopLog('stop-a', 'stop-a')).toBe(true);
  });

  it('returns false when the ids differ', () => {
    expect(isDuplicateStopLog('stop-a', 'stop-b')).toBe(false);
  });

  it('returns false when nothing has been logged yet', () => {
    expect(isDuplicateStopLog('stop-a', null)).toBe(false);
  });

  it('distinguishes first vs second call for the same stop after the in-function set', () => {
    // Anchors the timing invariant Run.tsx relies on: logCurrentStop sets
    // autoAdvancedStopRef synchronously before any await. The first call
    // for a stop sees the ref unset (returns false → log proceeds); a
    // subsequent re-entry for the same stop sees the ref now matching
    // (returns true → bail). The GPS branches MUST NOT pre-set the ref
    // themselves — doing so makes the in-function guard fire on the
    // first call and silently drop the log.
    let lastLogged: string | null = null;

    // First call for stop-a — ref still null.
    expect(isDuplicateStopLog('stop-a', lastLogged)).toBe(false);
    // logCurrentStop's synchronous set happens here.
    lastLogged = 'stop-a';

    // Second call for the same stop — ref now matches, must bail.
    expect(isDuplicateStopLog('stop-a', lastLogged)).toBe(true);

    // Run advances to next stop — currentStop.id changes; the stale ref
    // value no longer matches, so the new stop logs cleanly.
    expect(isDuplicateStopLog('stop-b', lastLogged)).toBe(false);
  });
});

describe('coerceFiniteOrNull', () => {
  it('returns null for null input', () => {
    expect(coerceFiniteOrNull(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(coerceFiniteOrNull(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(coerceFiniteOrNull(Number.NaN)).toBeNull();
  });

  it('returns null for positive Infinity', () => {
    expect(coerceFiniteOrNull(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('returns null for negative Infinity', () => {
    expect(coerceFiniteOrNull(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('returns the number unchanged for a finite non-zero value', () => {
    expect(coerceFiniteOrNull(42.5)).toBe(42.5);
  });

  it('returns 0 unchanged (must not coerce zero to null)', () => {
    expect(coerceFiniteOrNull(0)).toBe(0);
  });
});

describe('isInGpsGap', () => {
  const THRESHOLD = 20_000;

  it('returns false when no fix has been seen yet', () => {
    expect(isInGpsGap(1_000_000, null, THRESHOLD)).toBe(false);
  });

  it('returns false when a fix just landed', () => {
    expect(isInGpsGap(1_000_000, 1_000_000, THRESHOLD)).toBe(false);
  });

  it('returns false when the gap is exactly at the threshold', () => {
    // Spec uses strict >, so === threshold is NOT a gap.
    expect(isInGpsGap(1_020_000, 1_000_000, THRESHOLD)).toBe(false);
  });

  it('returns false when the gap is below the threshold', () => {
    expect(isInGpsGap(1_019_000, 1_000_000, THRESHOLD)).toBe(false);
  });

  it('returns true when the gap is above the threshold', () => {
    expect(isInGpsGap(1_021_000, 1_000_000, THRESHOLD)).toBe(true);
  });
});

describe('decideDropoutPrompt', () => {
  // Reference scenario: stop sits at (-34.20, 142.17), with a "next stop" 1 km
  // east. We construct bus positions relative to those points to land cleanly
  // inside or outside the passDistanceM radius.
  const STOP = { lat: -34.2, lng: 142.17 };
  const NEXT = { lat: -34.2, lng: 142.181 }; // ~1 km east of STOP
  const PASS_M = 50;

  // 0.001° latitude ≈ 111 m, so 0.001° south of STOP is ~111 m past it
  // (well outside the 50 m geofence).
  const PAST_STOP = { lat: -34.201, lng: 142.17 };

  it('returns gap_active when GPS is currently in a gap', () => {
    const result = decideDropoutPrompt({
      inGap: true,
      busLat: PAST_STOP.lat,
      busLng: PAST_STOP.lng,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: false, reason: 'gap_active' });
  });

  it('returns no_position when bus coords are missing', () => {
    const result = decideDropoutPrompt({
      inGap: false,
      busLat: null,
      busLng: null,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: false, reason: 'no_position' });
  });

  it('returns no_current_stop when the current stop has no coords', () => {
    const result = decideDropoutPrompt({
      inGap: false,
      busLat: PAST_STOP.lat,
      busLng: PAST_STOP.lng,
      currentStopLat: null,
      currentStopLng: null,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: false, reason: 'no_current_stop' });
  });

  it('returns before_stop when the bus is inside passDistanceM of the stop', () => {
    const result = decideDropoutPrompt({
      inGap: false,
      busLat: STOP.lat,
      busLng: STOP.lng,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: false, reason: 'before_stop' });
  });

  it('returns past_stop when bus is past the stop and there is no next waypoint', () => {
    const result = decideDropoutPrompt({
      inGap: false,
      busLat: PAST_STOP.lat,
      busLng: PAST_STOP.lng,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: null,
      nextStopLng: null,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: true, reason: 'past_stop' });
  });

  it('returns before_stop when the next waypoint is FURTHER than the current stop', () => {
    // Sanity-check the fixture: bus is ~111 m past the current stop,
    // and the next waypoint is ~1 km east of the current stop, so the
    // bus is closer to the current stop than to the next waypoint.
    expect(
      haversineMetres(PAST_STOP.lat, PAST_STOP.lng, STOP.lat, STOP.lng),
    ).toBeLessThan(haversineMetres(PAST_STOP.lat, PAST_STOP.lng, NEXT.lat, NEXT.lng));

    const result = decideDropoutPrompt({
      inGap: false,
      busLat: PAST_STOP.lat,
      busLng: PAST_STOP.lng,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: false, reason: 'before_stop' });
  });

  it('returns past_stop when the next waypoint is CLOSER than the current stop', () => {
    // Bus sits well past the current stop and very close to the next one.
    // 0.0001° ≈ 11 m — bus is essentially at NEXT.
    const busNearNext = { lat: NEXT.lat, lng: NEXT.lng + 0.0001 };
    const result = decideDropoutPrompt({
      inGap: false,
      busLat: busNearNext.lat,
      busLng: busNearNext.lng,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: true, reason: 'past_stop' });
  });

  it('returns before_stop when bus distance is exactly at passDistanceM (boundary uses <=)', () => {
    // Construct a bus position whose haversine distance to STOP equals
    // exactly PASS_M, then verify the boundary classifies as before_stop.
    // Solve for the longitude offset that yields PASS_M at STOP's latitude.
    // At lat=-34.2°, 1° of longitude ≈ cos(34.2°) * 111_320 m ≈ 92_098 m.
    // So PASS_M (50) → ~50 / 92_098 ≈ 0.000543° lon. Use a slightly tighter
    // value so haversine returns ≤ PASS_M — the helper uses `<=`.
    const busAtBoundary = { lat: STOP.lat, lng: STOP.lng + 0.00054 };
    const dist = haversineMetres(busAtBoundary.lat, busAtBoundary.lng, STOP.lat, STOP.lng);
    expect(dist).toBeLessThanOrEqual(PASS_M);

    const result = decideDropoutPrompt({
      inGap: false,
      busLat: busAtBoundary.lat,
      busLng: busAtBoundary.lng,
      currentStopLat: STOP.lat,
      currentStopLng: STOP.lng,
      nextStopLat: NEXT.lat,
      nextStopLng: NEXT.lng,
      passDistanceM: PASS_M,
    });
    expect(result).toEqual({ shouldPrompt: false, reason: 'before_stop' });
  });
});
