import type { RunState } from './types';

const KEY = 'drivermate.cdc.run';

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

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
