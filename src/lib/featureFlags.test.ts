import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFeatureEnabled } from './featureFlags';

const originalLocation = window.location;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, search },
    writable: true,
    configurable: true,
  });
}

describe('isFeatureEnabled', () => {
  it('defaults to true when no override is present', () => {
    setSearch('');
    expect(isFeatureEnabled('gps_recovery')).toBe(true);
  });

  it('returns false when ?gps_recovery=0 is present', () => {
    setSearch('?gps_recovery=0');
    expect(isFeatureEnabled('gps_recovery')).toBe(false);
  });

  it('returns true when ?gps_recovery=1 is present', () => {
    setSearch('?gps_recovery=1');
    expect(isFeatureEnabled('gps_recovery')).toBe(true);
  });

  it('falls back to the default when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(isFeatureEnabled('gps_recovery')).toBe(true);
  });
});
