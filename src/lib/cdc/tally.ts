import { ROUTES } from './stops';
import type { Passenger, RouteCode, StopCode } from './types';

export function expectedBoardingAt(passengers: Passenger[], stop: StopCode): Passenger[] {
  return passengers.filter((p) => p.joinStop === stop);
}

export type BoardingGroup = {
  // null = render as a single flat list (no destination header)
  destination: StopCode | null;
  passengers: Passenger[];
};

function compareSeat(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  const aNum = !Number.isNaN(na);
  const bNum = !Number.isNaN(nb);
  if (aNum && bNum && na !== nb) return na - nb;
  if (aNum && !bNum) return -1;
  if (!aNum && bNum) return 1;
  return a.localeCompare(b);
}

// At the first stop of the route, the bus loads up — most passengers walk up
// announcing the same end-of-line destination. Group by destination, biggest
// first (end-of-line wins ties), so the driver's expectation matches the list.
// Within each group, seat-number-ascending keeps the scan key intact.
// Other stops fall back to a single flat group (no header, current order).
export function groupedBoardingAt(
  passengers: Passenger[],
  currentStop: StopCode,
  routeCode: RouteCode,
): BoardingGroup[] {
  const boarders = expectedBoardingAt(passengers, currentStop);
  const stops = ROUTES[routeCode].stops;
  const isFirstStop = stops[0] === currentStop;
  const destinations = new Set(boarders.map((p) => p.leaveStop));

  if (!isFirstStop || destinations.size <= 1) {
    return [{ destination: null, passengers: boarders }];
  }

  const byDest = new Map<StopCode, Passenger[]>();
  for (const p of boarders) {
    const list = byDest.get(p.leaveStop) ?? [];
    list.push(p);
    byDest.set(p.leaveStop, list);
  }
  for (const list of byDest.values()) list.sort((a, b) => compareSeat(a.seat, b.seat));

  const groups: BoardingGroup[] = Array.from(byDest.entries()).map(([dest, pax]) => ({
    destination: dest,
    passengers: pax,
  }));
  groups.sort((a, b) => {
    if (b.passengers.length !== a.passengers.length) {
      return b.passengers.length - a.passengers.length;
    }
    return stops.indexOf(b.destination!) - stops.indexOf(a.destination!);
  });
  return groups;
}

export function expectedAlightingAt(passengers: Passenger[], stop: StopCode): Passenger[] {
  return passengers.filter(
    (p) =>
      p.leaveStop === stop &&
      (p.status === 'boarded' || p.status === 'walkup' || p.status === 'alighted' || p.status === 'expected'),
  );
}

export function onBoardAfter(
  passengers: Passenger[],
  routeCode: RouteCode,
  stopIndex: number,
): number {
  const stops = ROUTES[routeCode].stops;
  const reachedStops = new Set(stops.slice(0, stopIndex + 1));
  let count = 0;
  for (const p of passengers) {
    const boarded = p.status === 'boarded' || p.status === 'walkup' || p.status === 'alighted';
    if (!boarded) continue;
    const joinedByNow = reachedStops.has(p.joinStop);
    if (!joinedByNow) continue;
    const leftByNow = p.status === 'alighted' && reachedStops.has(p.leaveStop);
    if (leftByNow) continue;
    count += 1;
  }
  return count;
}

export function totalServiceBoardings(passengers: Passenger[]): number {
  return passengers.filter((p) => p.status === 'boarded' || p.status === 'walkup' || p.status === 'alighted')
    .length;
}

// At terminal stops the driver enters a boarded count rather than tapping
// each row (V/Line staff already crossed the paper manifest). Translate that
// count into per-row statuses by deterministically promoting the lowest seat
// numbers to 'boarded' first, leaving the rest as 'expected' (no-show).
// Walk-ups and already-alighted rows are left untouched.
export function setBoardedCountAt(
  passengers: Passenger[],
  stop: StopCode,
  count: number,
): Passenger[] {
  const seatRank = (s: string): [number, string] => {
    const n = parseInt(s, 10);
    return [Number.isNaN(n) ? Number.POSITIVE_INFINITY : n, s];
  };
  const here = passengers
    .filter((p) => p.joinStop === stop && p.status !== 'walkup' && p.status !== 'alighted')
    .sort((a, b) => {
      const [an, as] = seatRank(a.seat);
      const [bn, bs] = seatRank(b.seat);
      if (an !== bn) return an - bn;
      return as.localeCompare(bs);
    });
  const boardedIds = new Set(here.slice(0, Math.max(0, count)).map((p) => p.id));
  return passengers.map((p) => {
    if (p.joinStop !== stop) return p;
    if (p.status === 'walkup' || p.status === 'alighted') return p;
    return { ...p, status: boardedIds.has(p.id) ? 'boarded' : 'expected' };
  });
}

export type StopSummary = { stop: StopCode; pickups: number; dropoffs: number };

export function stopSummary(passengers: Passenger[], routeCode: RouteCode): StopSummary[] {
  const stops = ROUTES[routeCode].stops;
  return stops.map((stop) => ({
    stop,
    pickups: passengers.filter((p) => p.joinStop === stop).length,
    dropoffs: passengers.filter((p) => p.leaveStop === stop).length,
  }));
}
