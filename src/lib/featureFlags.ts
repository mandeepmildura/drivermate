type FlagKey = 'gps_recovery';

const DEFAULTS: Record<FlagKey, boolean> = {
  gps_recovery: true,
};

const QUERY_KEYS: Record<FlagKey, string> = {
  gps_recovery: 'gps_recovery',
};

export function isFeatureEnabled(flag: FlagKey): boolean {
  if (typeof window === 'undefined') return DEFAULTS[flag];
  const param = new URLSearchParams(window.location.search).get(QUERY_KEYS[flag]);
  if (param === '0' || param === 'false') return false;
  if (param === '1' || param === 'true') return true;
  return DEFAULTS[flag];
}
