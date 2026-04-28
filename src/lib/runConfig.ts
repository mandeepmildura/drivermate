// Shared between Run.tsx (live driver flow) and AdminReplay.tsx (breadcrumb
// playback). Keep in lockstep — replay is meaningless if it disagrees with
// production thresholds.

export const AUDIO_TRIGGER_M = 150;
export const ARRIVED_DISTANCE_M = 50;
export const ARRIVAL_DWELL_MS_STOP = 8_000;
export const ARRIVAL_DWELL_MS_TURN = 0;
export const BREADCRUMB_INTERVAL_MS = 5_000;
