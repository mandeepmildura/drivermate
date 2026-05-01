import type { Passenger, RouteCode, RunState } from './types';

const KEY = 'drivermate.cdc.run';
const PENDING_KEY = 'drivermate.cdc.pendingManifest';
const SAVED_KEY = 'drivermate.cdc.savedManifests';

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

// Saved manifest snapshots — admin-only "test library" so a single OCR run
// can be replayed many times against the simulator without re-uploading
// photos. Stored locally per-device; never synced.
export type SavedManifest = {
  id: string;
  name: string;
  savedAt: string;
  routeCode: RouteCode;
  passengers: Passenger[];
};

export function listSavedManifests(): SavedManifest[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedManifest[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && m.id && Array.isArray(m.passengers));
  } catch {
    return [];
  }
}

export function saveNamedManifest(name: string, routeCode: RouteCode, passengers: Passenger[]): SavedManifest {
  const entry: SavedManifest = {
    id: newId(),
    name: name.trim() || `Snapshot ${new Date().toLocaleString()}`,
    savedAt: new Date().toISOString(),
    routeCode,
    // Reset statuses so the snapshot is replayable from scratch.
    passengers: passengers.map((p) => ({ ...p, id: newId(), status: 'expected' })),
  };
  const existing = listSavedManifests();
  const next = [entry, ...existing].slice(0, 20);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // localStorage full — silently ignore so we don't crash the manifest page.
  }
  return entry;
}

export function deleteSavedManifest(id: string): void {
  const next = listSavedManifests().filter((m) => m.id !== id);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
