import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type RouteStopRow, type StopEventRow, type ShiftRow } from './db';

export type OnTimeStatus = 'early' | 'ontime' | 'delayed' | 'late';

export function statusForScheduled(
  scheduledTime: string | null,
  now: Date = new Date(),
): OnTimeStatus {
  if (!scheduledTime) return 'ontime';
  const parts = scheduledTime.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return 'ontime';
  const [h, m] = parts;
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const deltaMin = (now.getTime() - target.getTime()) / 60_000;
  if (deltaMin < -1) return 'early';
  if (deltaMin <= 2) return 'ontime';
  if (deltaMin <= 5) return 'delayed';
  return 'late';
}

export function bandClass(status: OnTimeStatus): string {
  switch (status) {
    case 'late':
      return 'bg-late/20 text-red-200';
    case 'delayed':
      return 'bg-delayed/20 text-amber-200';
    default:
      return 'bg-ontime/20 text-emerald-200';
  }
}

export function formatElapsed(startedAt: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(startedAt).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function useActiveShift(driverId: string | null): ShiftRow | null | undefined {
  // undefined = live query still loading; null = no open shift; ShiftRow = found
  return useLiveQuery(async () => {
    if (!driverId) return null;
    const open = await db.shifts
      .where('driver_id')
      .equals(driverId)
      .filter((s) => !s.ended_at)
      .toArray();
    open.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return open[0] ?? null;
  }, [driverId]);
}

export interface RunSnapshot {
  stops: RouteStopRow[];
  events: StopEventRow[];
  eventByStopId: Map<string, StopEventRow>;
  currentIndex: number;
  totalPickups: number;
  done: boolean;
}

export function useRunSnapshot(shift: ShiftRow | null | undefined): RunSnapshot {
  const stops = useLiveQuery(
    () =>
      shift
        ? db.route_stops.where('route_id').equals(shift.route_id).sortBy('sequence')
        : Promise.resolve([] as RouteStopRow[]),
    [shift?.route_id],
    [] as RouteStopRow[],
  );

  const events = useLiveQuery(
    () =>
      shift
        ? db.stop_events.where('shift_id').equals(shift.id).toArray()
        : Promise.resolve([] as StopEventRow[]),
    [shift?.id],
    [] as StopEventRow[],
  );

  return useMemo(() => {
    // Belt for tablets that cached duplicate route_stops rows before
    // loadRouteStops learned to replace-on-fetch. Without this the run banner
    // can stick on a turn the driver already skipped because the stop_event
    // is keyed to one row's id but currentIndex lands on the other.
    const dedupedStops: RouteStopRow[] = [];
    const seenKeys = new Set<string>();
    for (const s of stops) {
      const key = `${s.kind}|${s.lat}|${s.lng}|${s.instruction_text ?? ''}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      dedupedStops.push(s);
    }
    const eventByStopId = new Map(events.map((e) => [e.route_stop_id, e]));
    let currentIndex = dedupedStops.length;
    for (let i = 0; i < dedupedStops.length; i++) {
      if (!eventByStopId.has(dedupedStops[i].id)) {
        currentIndex = i;
        break;
      }
    }
    const totalPickups = events.reduce((sum, e) => sum + e.pickup_count, 0);
    return {
      stops: dedupedStops,
      events,
      eventByStopId,
      currentIndex,
      totalPickups,
      done: currentIndex >= dedupedStops.length && dedupedStops.length > 0,
    };
  }, [stops, events]);
}
