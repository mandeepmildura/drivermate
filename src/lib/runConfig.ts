// Shared between Run.tsx (live driver flow) and AdminReplay.tsx (breadcrumb
// playback). Keep in lockstep — replay is meaningless if it disagrees with
// production thresholds.

export const AUDIO_TRIGGER_M = 150;
export const ARRIVED_DISTANCE_M = 50;
export const ARRIVAL_DWELL_MS_STOP = 8_000;
// Turns advance only via hasPassedWaypoint (route-line projection), not via
// the 50 m geofence. Being 50 m from a turn waypoint just means the driver is
// approaching it — the maneuver hasn't happened yet, and showing the next
// instruction at that moment confuses drivers who are still lining up the turn.
export const BREADCRUMB_INTERVAL_MS = 5_000;
export const GPS_GAP_THRESHOLD_MS = 20_000;
export const DROPOUT_PROMPT_REAPPEAR_MS = 10_000;
