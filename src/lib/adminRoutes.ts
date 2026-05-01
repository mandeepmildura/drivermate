import { db, type RouteRow, type RouteStopRow, type RouteStopKind, type ServiceType } from './db';
import { getSupabase } from './supabase';
import type { Json } from '../types/database';

export interface RouteDraft {
  route_number: string;
  display_number: string | null;
  description: string | null;
  active: boolean;
  locked: boolean;
  service_type: ServiceType;
  path_geojson: Json | null;
}

export interface StopDraft {
  id?: string;
  sequence: number;
  kind: RouteStopKind;
  stop_name: string;
  scheduled_time: string | null;
  instruction_text: string | null;
  instruction_audio_cue: string | null;
  lat: number | null;
  lng: number | null;
}

export async function listAllRoutes(): Promise<RouteRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('routes')
    .select('id, route_number, display_number, description, active, locked, version, updated_at, service_type')
    .order('route_number');
  if (error) throw error;
  const rows = (data ?? []) as RouteRow[];
  if (rows.length > 0) await db.routes.bulkPut(rows);
  return rows;
}

export async function getRouteWithStops(
  routeId: string,
): Promise<{ route: RouteRow; stops: RouteStopRow[] }> {
  const supabase = getSupabase();
  const [routeRes, stopsRes] = await Promise.all([
    supabase
      .from('routes')
      .select('id, route_number, display_number, description, active, locked, version, updated_at, service_type, path_geojson')
      .eq('id', routeId)
      .single(),
    supabase.from('route_stops').select('*').eq('route_id', routeId).order('sequence'),
  ]);

  if (routeRes.error) throw routeRes.error;
  if (stopsRes.error) throw stopsRes.error;

  const route = routeRes.data as RouteRow;
  const stops = (stopsRes.data ?? []) as RouteStopRow[];

  await db.routes.put(route);
  if (stops.length > 0) await db.route_stops.bulkPut(stops);

  return { route, stops };
}

export async function createRoute(draft: RouteDraft): Promise<RouteRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('routes').insert(draft).select().single();
  if (error) throw error;
  const row = data as RouteRow;
  await db.routes.put(row);
  return row;
}

export async function updateRoute(routeId: string, draft: RouteDraft): Promise<RouteRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('routes')
    .update(draft)
    .eq('id', routeId)
    .select()
    .single();
  if (error) throw error;
  const row = data as RouteRow;
  await db.routes.put(row);
  return row;
}

export async function setRouteLocked(routeId: string, locked: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('routes').update({ locked }).eq('id', routeId);
  if (error) throw error;
  const cached = await db.routes.get(routeId);
  if (cached) await db.routes.put({ ...cached, locked });
}

export async function saveStops(
  routeId: string,
  drafts: StopDraft[],
  removedStopIds: string[],
): Promise<RouteStopRow[]> {
  const supabase = getSupabase();

  if (removedStopIds.length > 0) {
    const { error } = await supabase.from('route_stops').delete().in('id', removedStopIds);
    if (error) throw error;
    await db.route_stops.bulkDelete(removedStopIds);
  }

  if (drafts.length === 0) return [];

  const payload = drafts.map((s) => ({
    ...(s.id ? { id: s.id } : {}),
    route_id: routeId,
    sequence: s.sequence,
    kind: s.kind,
    stop_name: s.stop_name,
    scheduled_time: s.scheduled_time,
    instruction_text: s.instruction_text,
    instruction_audio_cue: s.instruction_audio_cue,
    lat: s.lat,
    lng: s.lng,
  }));

  const { data, error } = await supabase
    .from('route_stops')
    .upsert(payload, { onConflict: 'id' })
    .select();
  if (error) throw error;

  const rows = (data ?? []) as RouteStopRow[];
  if (rows.length > 0) await db.route_stops.bulkPut(rows);
  return rows;
}

// Inserts a batch of turn waypoints between two existing stops by calling
// the insert_turn_waypoints RPC, which renumbers downstream sequences in a
// transaction so the UNIQUE(route_id, sequence) constraint never trips.
export interface TurnDraft {
  instruction_text: string;
  lat: number;
  lng: number;
}

export async function insertTurnWaypoints(
  routeId: string,
  afterSequence: number,
  turns: TurnDraft[],
): Promise<RouteStopRow[]> {
  if (turns.length === 0) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('insert_turn_waypoints', {
    p_route_id: routeId,
    p_after_sequence: afterSequence,
    p_turns: turns as unknown as Json,
  });
  if (error) throw error;
  // Refetch the full route_stops list so Dexie reflects the renumbered
  // downstream sequences too — the RPC only returns the inserted rows.
  const refresh = await supabase
    .from('route_stops')
    .select('*')
    .eq('route_id', routeId)
    .order('sequence');
  if (refresh.error) throw refresh.error;
  await db.route_stops.where('route_id').equals(routeId).delete();
  const rows = (refresh.data ?? []) as RouteStopRow[];
  if (rows.length > 0) await db.route_stops.bulkPut(rows);
  return (data ?? []) as RouteStopRow[];
}
