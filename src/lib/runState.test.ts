import { describe, expect, it } from 'vitest';
import { coerceFiniteOrNull, isDuplicateStopLog } from './runState';

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
