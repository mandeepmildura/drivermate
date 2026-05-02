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
