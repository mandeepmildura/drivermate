import Dexie, { type Table } from 'dexie';

export interface DriverRow {
  id: string;
  driver_number: string;
  full_name: string;
  is_admin: boolean;
  active: boolean;
}

export interface BusRow {
  id: string;
  bus_code: string;
  rego: string | null;
  active: boolean;
}

export interface RouteRow {
  id: string;
  route_number: string;
  display_number: string | null;
  description: string | null;
  active: boolean;
  locked: boolean;
  version: number;
  updated_at: string;
}

export type RouteStopKind = 'stop' | 'turn';

export interface RouteStopRow {
  id: string;
  route_id: string;
  sequence: number;
  kind: RouteStopKind;
  stop_name: string;
  scheduled_time: string | null;
  instruction_text: string | null;
  instruction_audio_cue: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ShiftRow {
  id: string;
  driver_id: string;
  route_id: string;
  bus_id: string | null;
  bus_code_override: string | null;
  started_at: string;
  ended_at: string | null;
  client_created_at: string;
  synced_at: string | null;
}

export interface StopEventRow {
  id: string;
  shift_id: string;
  route_stop_id: string;
  arrived_at: string;
  pickup_count: number;
  note: string | null;
  synced_at: string | null;
}

export type SyncEntity = 'shift' | 'stop_event';
export type SyncOp = 'upsert';

export interface PendingMutation {
  id?: number;
  entity: SyncEntity;
  op: SyncOp;
  row_id: string;
  payload: Record<string, unknown>;
  enqueued_at: string;
  attempts: number;
  last_error: string | null;
}

class DriverMateDB extends Dexie {
  drivers!: Table<DriverRow, string>;
  buses!: Table<BusRow, string>;
  routes!: Table<RouteRow, string>;
  route_stops!: Table<RouteStopRow, string>;
  shifts!: Table<ShiftRow, string>;
  stop_events!: Table<StopEventRow, string>;
  pending!: Table<PendingMutation, number>;

  constructor() {
    super('drivermate');
    this.version(1).stores({
      drivers: 'id, driver_number',
      buses: 'id, bus_code, active',
      routes: 'id, route_number, active',
      route_stops: 'id, route_id, [route_id+sequence]',
      shifts: 'id, driver_id, started_at, synced_at',
      stop_events: 'id, shift_id, synced_at',
      pending: '++id, entity, enqueued_at',
    });
  }
}

export const db = new DriverMateDB();
