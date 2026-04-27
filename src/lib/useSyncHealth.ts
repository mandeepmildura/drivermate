import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PendingMutation } from './db';

const FAILED_THRESHOLD = 3; // attempts >= this counts as "stuck"

export interface SyncHealth {
  pending: number;
  failing: number;
  paused: number; // attempts >= MAX_ATTEMPTS_BEFORE_PAUSE in sync.ts (5)
  lastError: string | null;
  lastErrorEntity: PendingMutation['entity'] | null;
}

const MAX_ATTEMPTS_BEFORE_PAUSE = 5;

/**
 * Live snapshot of the sync queue health for the current tablet.
 *
 * - `pending`: total rows waiting to upload.
 * - `failing`: subset that has been retried 3+ times but isn't paused yet.
 * - `paused`: rows that have hit the attempt cap and won't retry until reset.
 * - `lastError`: most recent server error message across the queue.
 *
 * Refreshes automatically as Dexie writes happen — no need to wire intervals.
 */
export function useSyncHealth(): SyncHealth {
  return (
    useLiveQuery(async () => {
      const all = await db.pending.toArray();
      const failing = all.filter(
        (m) => m.attempts >= FAILED_THRESHOLD && m.attempts < MAX_ATTEMPTS_BEFORE_PAUSE,
      );
      const paused = all.filter((m) => m.attempts >= MAX_ATTEMPTS_BEFORE_PAUSE);
      const withErr = all.filter((m) => m.last_error != null);
      const last = withErr.length > 0 ? withErr[withErr.length - 1] : null;
      return {
        pending: all.length,
        failing: failing.length,
        paused: paused.length,
        lastError: last?.last_error ?? null,
        lastErrorEntity: last?.entity ?? null,
      };
    }, []) ?? { pending: 0, failing: 0, paused: 0, lastError: null, lastErrorEntity: null }
  );
}
