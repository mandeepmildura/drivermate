import { db, type GpsBreadcrumbRow, type PendingMutation, type ShiftRow, type StopEventRow } from './db';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { Database } from '../types/database';

type WritableTable = keyof Database['public']['Tables'];

const TABLE_FOR_ENTITY: Record<PendingMutation['entity'], WritableTable> = {
  shift: 'shifts',
  stop_event: 'stop_events',
  gps_breadcrumb: 'gps_breadcrumbs',
};

const MAX_ATTEMPTS_BEFORE_PAUSE = 5;
const SYNC_INTERVAL_MS = 30_000;

export interface SyncResult {
  pushed: number;
  failed: number;
  skipped: 'offline' | 'unconfigured' | null;
}

export async function recordShift(shift: ShiftRow): Promise<void> {
  await db.transaction('rw', db.shifts, db.pending, async () => {
    await db.shifts.put(shift);
    await enqueue('shift', shift.id, shift as unknown as Record<string, unknown>);
  });
}

export async function recordStopEvent(event: StopEventRow): Promise<void> {
  await db.transaction('rw', db.stop_events, db.pending, async () => {
    await db.stop_events.put(event);
    await enqueue('stop_event', event.id, event as unknown as Record<string, unknown>);
  });
}

export async function recordBreadcrumb(crumb: GpsBreadcrumbRow): Promise<void> {
  // Defence-in-depth: server has lat/lng NOT NULL, so a non-finite reading
  // would wedge the sync queue with a permanent 400. Run.tsx's tick already
  // filters these, but reject here too so future callers can't bypass.
  if (!Number.isFinite(crumb.lat) || !Number.isFinite(crumb.lng)) return;
  await db.transaction('rw', db.gps_breadcrumbs, db.pending, async () => {
    await db.gps_breadcrumbs.put(crumb);
    await enqueue('gps_breadcrumb', crumb.id, crumb as unknown as Record<string, unknown>);
  });
}

async function enqueue(
  entity: PendingMutation['entity'],
  rowId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.pending.add({
    entity,
    op: 'upsert',
    row_id: rowId,
    payload,
    enqueued_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
  });
}

export async function flushPendingMutations(): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { pushed: 0, failed: 0, skipped: 'unconfigured' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { pushed: 0, failed: 0, skipped: 'offline' };
  }

  const supabase = getSupabase();
  // attempts isn't an indexed column on the pending table, so filter in memory
  // (the queue is small — under 10k rows even on a long offline stretch).
  const all = await db.pending.orderBy('enqueued_at').toArray();
  const pending = all.filter((m) => m.attempts < MAX_ATTEMPTS_BEFORE_PAUSE);

  let pushed = 0;
  let failed = 0;

  for (const mutation of pending) {
    const table = TABLE_FOR_ENTITY[mutation.entity];
    // Strip synced_at — that column is NOT NULL DEFAULT now() server-side,
    // and a null payload would be rejected as 400 Bad Request.
    const { synced_at: _drop, ...payload } = mutation.payload as Record<string, unknown>;
    void _drop;
    // Payload shape varies per entity; the typed client wants a discriminated
    // union we can't easily produce from the generic queue, so cast at the
    // upsert call site only.
    const { error } = await supabase.from(table).upsert(payload as never);

    if (error) {
      failed += 1;
      await db.pending.update(mutation.id!, {
        attempts: mutation.attempts + 1,
        last_error: error.message,
      });
      continue;
    }

    pushed += 1;
    await db.pending.delete(mutation.id!);
    const stamp = new Date().toISOString();
    if (mutation.entity === 'shift') {
      await db.shifts.update(mutation.row_id, { synced_at: stamp });
    } else if (mutation.entity === 'stop_event') {
      await db.stop_events.update(mutation.row_id, { synced_at: stamp });
    } else if (mutation.entity === 'gps_breadcrumb') {
      await db.gps_breadcrumbs.update(mutation.row_id, { synced_at: stamp });
    }
  }

  return { pushed, failed, skipped: null };
}

export function startSyncLoop(): () => void {
  if (typeof window === 'undefined') return () => {};

  const tick = () => {
    flushPendingMutations().catch((err) => {
      console.warn('[drivermate] sync flush failed:', err);
    });
  };

  tick();
  const onOnline = () => tick();
  window.addEventListener('online', onOnline);
  const interval = window.setInterval(tick, SYNC_INTERVAL_MS);

  return () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(interval);
  };
}

export async function pendingCount(): Promise<number> {
  return db.pending.count();
}
