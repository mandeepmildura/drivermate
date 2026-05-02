import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

// Stub Supabase before importing auth — auth.ts grabs the client when its
// signOutDriver function is called. We don't care about the auth flow itself
// here; we care that the local Dexie wipe covers gps_breadcrumbs alongside
// the existing driver-scoped tables.
vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: {
      signOut: async () => ({ error: null }),
    },
  }),
}));

const { signOutDriver } = await import('./auth');

beforeEach(async () => {
  await db.drivers.clear();
  await db.shifts.clear();
  await db.stop_events.clear();
  await db.gps_breadcrumbs.clear();
  await db.pending.clear();
});

describe('signOutDriver', () => {
  it('clears gps_breadcrumbs along with the other driver-scoped tables', async () => {
    await db.drivers.put({
      id: 'd1',
      driver_number: '1234',
      full_name: 'Driver One',
      is_admin: false,
      active: true,
      can_drive_vline: false,
    });
    await db.shifts.put({
      id: 'shift-1',
      driver_id: 'd1',
      route_id: 'r1',
      bus_id: null,
      bus_code_override: null,
      started_at: '2026-04-25T07:48:00Z',
      ended_at: null,
      client_created_at: '2026-04-25T07:48:00Z',
      synced_at: null,
    });
    await db.stop_events.put({
      id: 'evt-1',
      shift_id: 'shift-1',
      route_stop_id: 'rs-1',
      arrived_at: '2026-04-25T07:50:00Z',
      pickup_count: 2,
      note: null,
      synced_at: null,
    });
    await db.gps_breadcrumbs.put({
      id: 'crumb-1',
      shift_id: 'shift-1',
      recorded_at: '2026-04-25T07:50:05Z',
      lat: -34.2,
      lng: 142.17,
      heading: 90,
      speed: 12,
      accuracy: 5,
      synced_at: null,
    });
    await db.pending.add({
      entity: 'shift',
      op: 'upsert',
      row_id: 'shift-1',
      payload: { id: 'shift-1' },
      enqueued_at: '2026-04-25T07:48:00Z',
      attempts: 0,
      last_error: null,
    });

    await signOutDriver();

    expect(await db.drivers.count()).toBe(0);
    expect(await db.shifts.count()).toBe(0);
    expect(await db.stop_events.count()).toBe(0);
    expect(await db.gps_breadcrumbs.count()).toBe(0);
    expect(await db.pending.count()).toBe(0);
  });
});
