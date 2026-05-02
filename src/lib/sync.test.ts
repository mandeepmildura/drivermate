import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

// Mock the Supabase module BEFORE importing sync — sync grabs the client at
// module load. We capture every upsert call so the test can assert on shape.
type UpsertCall = { table: string; payload: Record<string, unknown> };
const upsertCalls: UpsertCall[] = [];
let nextUpsertResult: { error: { message: string } | null } = { error: null };

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    from: (table: string) => ({
      upsert: async (payload: Record<string, unknown>) => {
        upsertCalls.push({ table, payload });
        return nextUpsertResult;
      },
    }),
  }),
}));

const { recordShift, recordStopEvent, recordBreadcrumb, flushPendingMutations } =
  await import('./sync');

beforeEach(async () => {
  upsertCalls.length = 0;
  nextUpsertResult = { error: null };
  await db.shifts.clear();
  await db.stop_events.clear();
  await db.gps_breadcrumbs.clear();
  await db.pending.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sync.flushPendingMutations', () => {
  it('drains queued shifts to the shifts table', async () => {
    await recordShift({
      id: 'shift-1',
      driver_id: 'driver-1',
      route_id: 'route-1',
      bus_id: null,
      bus_code_override: null,
      started_at: '2026-04-25T07:48:00Z',
      ended_at: null,
      client_created_at: '2026-04-25T07:48:00Z',
      synced_at: null,
    });

    const result = await flushPendingMutations();

    expect(result).toEqual({ pushed: 1, failed: 0, skipped: null });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].table).toBe('shifts');
  });

  it('strips synced_at from upsert payload (the live 400 bug)', async () => {
    await recordShift({
      id: 'shift-2',
      driver_id: 'driver-1',
      route_id: 'route-1',
      bus_id: null,
      bus_code_override: null,
      started_at: '2026-04-25T07:48:00Z',
      ended_at: null,
      client_created_at: '2026-04-25T07:48:00Z',
      synced_at: null,
    });
    await flushPendingMutations();

    expect(upsertCalls[0].payload).not.toHaveProperty('synced_at');
    // Other required fields must still be present
    expect(upsertCalls[0].payload).toMatchObject({
      id: 'shift-2',
      driver_id: 'driver-1',
      route_id: 'route-1',
    });
  });

  it('processes mixed entity types in enqueue order', async () => {
    await recordShift({
      id: 'shift-3',
      driver_id: 'd1',
      route_id: 'r1',
      bus_id: null,
      bus_code_override: null,
      started_at: '2026-04-25T07:48:00Z',
      ended_at: null,
      client_created_at: '2026-04-25T07:48:00Z',
      synced_at: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    await recordStopEvent({
      id: 'evt-1',
      shift_id: 'shift-3',
      route_stop_id: 'rs-1',
      arrived_at: '2026-04-25T07:50:00Z',
      pickup_count: 3,
      note: null,
      synced_at: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    await recordBreadcrumb({
      id: 'crumb-1',
      shift_id: 'shift-3',
      recorded_at: '2026-04-25T07:50:05Z',
      lat: -34.2,
      lng: 142.17,
      heading: 90,
      speed: 12,
      accuracy: 5,
      synced_at: null,
    });

    const result = await flushPendingMutations();

    expect(result.pushed).toBe(3);
    expect(upsertCalls.map((c) => c.table)).toEqual([
      'shifts',
      'stop_events',
      'gps_breadcrumbs',
    ]);
  });

  it('marks rows as synced after successful upsert', async () => {
    await recordShift({
      id: 'shift-4',
      driver_id: 'd1',
      route_id: 'r1',
      bus_id: null,
      bus_code_override: null,
      started_at: '2026-04-25T07:48:00Z',
      ended_at: null,
      client_created_at: '2026-04-25T07:48:00Z',
      synced_at: null,
    });
    await flushPendingMutations();
    const row = await db.shifts.get('shift-4');
    expect(row?.synced_at).toMatch(/^2026/);
  });

  it('keeps mutations in queue and bumps attempts on failure', async () => {
    nextUpsertResult = { error: { message: 'Network unreachable' } };
    await recordShift({
      id: 'shift-5',
      driver_id: 'd1',
      route_id: 'r1',
      bus_id: null,
      bus_code_override: null,
      started_at: '2026-04-25T07:48:00Z',
      ended_at: null,
      client_created_at: '2026-04-25T07:48:00Z',
      synced_at: null,
    });

    const r = await flushPendingMutations();
    expect(r.failed).toBe(1);

    const remaining = await db.pending.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attempts).toBe(1);
    expect(remaining[0].last_error).toBe('Network unreachable');
  });

  it('recordStopEvent same id → 1 row; different ids → 2 rows (dedupe invariant)', async () => {
    // Documents why the Run.tsx isDuplicateStopLog guard matters: the data
    // layer dedupes by primary key, NOT by route_stop_id. Two manual taps
    // generated two fresh UUIDs and produced two rows — that's the bug the
    // upper-layer guard prevents.
    await recordStopEvent({
      id: 'evt-dupe-1',
      shift_id: 'shift-x',
      route_stop_id: 'rs-1',
      arrived_at: '2026-04-25T07:50:00Z',
      pickup_count: 3,
      note: null,
      synced_at: null,
    });
    await recordStopEvent({
      id: 'evt-dupe-1',
      shift_id: 'shift-x',
      route_stop_id: 'rs-1',
      arrived_at: '2026-04-25T07:50:00Z',
      pickup_count: 3,
      note: null,
      synced_at: null,
    });
    expect(await db.stop_events.count()).toBe(1);

    await recordStopEvent({
      id: 'evt-dupe-2',
      shift_id: 'shift-x',
      route_stop_id: 'rs-1',
      arrived_at: '2026-04-25T07:50:01Z',
      pickup_count: 3,
      note: null,
      synced_at: null,
    });
    expect(await db.stop_events.count()).toBe(2);
  });

  it('recordBreadcrumb rejects non-finite lat (NOT NULL on server, would wedge sync)', async () => {
    await recordBreadcrumb({
      id: 'crumb-bad-lat',
      shift_id: 'shift-x',
      recorded_at: '2026-04-25T07:50:00Z',
      lat: Number.NaN,
      lng: 142.17,
      heading: 90,
      speed: 12,
      accuracy: 5,
      synced_at: null,
    });
    expect(await db.gps_breadcrumbs.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('recordBreadcrumb rejects non-finite lng', async () => {
    await recordBreadcrumb({
      id: 'crumb-bad-lng',
      shift_id: 'shift-x',
      recorded_at: '2026-04-25T07:50:00Z',
      lat: -34.2,
      lng: Number.POSITIVE_INFINITY,
      heading: 90,
      speed: 12,
      accuracy: 5,
      synced_at: null,
    });
    expect(await db.gps_breadcrumbs.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });

  it('recordBreadcrumb accepts finite lat/lng with null optional fields', async () => {
    await recordBreadcrumb({
      id: 'crumb-ok',
      shift_id: 'shift-x',
      recorded_at: '2026-04-25T07:50:00Z',
      lat: -34.2,
      lng: 142.17,
      heading: null,
      speed: null,
      accuracy: null,
      synced_at: null,
    });
    expect(await db.gps_breadcrumbs.count()).toBe(1);
    expect(await db.pending.count()).toBe(1);
  });

  it('survives the unindexed-attempts query (the SchemaError bug)', async () => {
    // Queue 6 mutations and mark some as having high attempts. The bug was
    // db.pending.where('attempts').below(5) throwing because attempts isn't
    // indexed. The new path filters in memory, so this just works.
    for (let i = 0; i < 6; i++) {
      await recordShift({
        id: `shift-bug-${i}`,
        driver_id: 'd1',
        route_id: 'r1',
        bus_id: null,
        bus_code_override: null,
        started_at: '2026-04-25T07:48:00Z',
        ended_at: null,
        client_created_at: '2026-04-25T07:48:00Z',
        synced_at: null,
      });
    }
    // Manually pretend two mutations have already failed too many times
    const all = await db.pending.toArray();
    await db.pending.update(all[0].id!, { attempts: 5 });
    await db.pending.update(all[1].id!, { attempts: 7 });

    const result = await flushPendingMutations();

    // Only the four with attempts < 5 should be pushed, no SchemaError
    expect(result.pushed).toBe(4);
    expect(result.skipped).toBeNull();
  });
});
