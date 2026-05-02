import { describe, expect, it } from 'vitest';
import { isDuplicateStopLog } from './runState';

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
