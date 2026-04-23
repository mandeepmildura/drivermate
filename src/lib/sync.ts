import { db, type PendingMutation, type ShiftRow, type StopEventRow } from './db';
import { getSupabase, isSupabaseConfigured } from './supabase';

const TABLE_FOR_ENTITY: Record<PendingMutation['entity'], string> = {
  shift: 'shifts',
  stop_event: 'stop_events',
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
  const pending = await db.pending
    .where('attempts')
    .below(MAX_ATTEMPTS_BEFORE_PAUSE)
    .sortBy('enqueued_at');

  let pushed = 0;
  let failed = 0;

  for (const mutation of pending) {
    const table = TABLE_FOR_ENTITY[mutation.entity];
    const { error } = await supabase.from(table).upsert(mutation.payload);

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
    } else {
      await db.stop_events.update(mutation.row_id, { synced_at: stamp });
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
