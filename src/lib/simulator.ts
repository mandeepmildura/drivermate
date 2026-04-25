// Tiny pub/sub for fake GPS positions. When active, the geolocation hook
// uses these instead of the real navigator.geolocation watch. Dev-only —
// the simulator UI is hidden in production, and nothing calls into this
// module otherwise.

export interface SimulatedPosition {
  lat: number;
  lng: number;
  heading?: number | null;
}

let active: SimulatedPosition | null = null;
const listeners = new Set<() => void>();

export function setSimulatedPosition(pos: SimulatedPosition | null): void {
  active = pos;
  listeners.forEach((fn) => fn());
}

export function getSimulatedPosition(): SimulatedPosition | null {
  return active;
}

export function subscribeSimulator(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
