import { ROUTES } from './stops';
import type { Passenger, RouteCode, StopCode } from './types';

export function expectedBoardingAt(passengers: Passenger[], stop: StopCode): Passenger[] {
  return passengers.filter((p) => p.joinStop === stop);
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

export type StopSummary = { stop: StopCode; pickups: number; dropoffs: number };

export function stopSummary(passengers: Passenger[], routeCode: RouteCode): StopSummary[] {
  const stops = ROUTES[routeCode].stops;
  return stops.map((stop) => ({
    stop,
    pickups: passengers.filter((p) => p.joinStop === stop).length,
    dropoffs: passengers.filter((p) => p.leaveStop === stop).length,
  }));
}
