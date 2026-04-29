import type { Passenger, RouteCode, RunState } from './types';

const KEY = 'drivermate.cdc.run';
const PENDING_KEY = 'drivermate.cdc.pendingManifest';

export function loadRunState(): RunState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (!parsed.routeCode || !Array.isArray(parsed.passengers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRunState(state: RunState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage full or disabled — silently drop; UI remains functional in-memory.
  }
}

export function clearRunState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// A scanned manifest waiting for the driver to start the run. Survives tab
// close and phone lock so the typical "scan → load luggage → head count"
// gap (often 30+ minutes) doesn't lose any work.
export type PendingManifest = {
  routeCode: RouteCode;
  passengers: Passenger[];
  ocrAt: string;
};

export function loadPendingManifest(): PendingManifest | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingManifest;
    if (!parsed.routeCode || !Array.isArray(parsed.passengers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingManifest(state: PendingManifest): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearPendingManifest(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
