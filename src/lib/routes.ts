import { db, type RouteRow, type RouteStopRow, type BusRow } from './db';
import { getSupabase, isSupabaseConfigured } from './supabase';

export interface CachedFetchResult<T> {
  rows: T[];
  source: 'remote' | 'cache';
  error?: string;
}

export async function loadActiveRoutes(): Promise<CachedFetchResult<RouteRow>> {
  if (!isSupabaseConfigured) {
    const local = (await db.routes.toArray()).filter((r) => r.active);
    return { rows: local, source: 'cache' };
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('routes')
      .select('id, route_number, display_number, description, active, locked, version, updated_at')
      .eq('active', true)
      .order('route_number');
    if (error) throw error;

    // path_geojson is fetched lazily by loadRoutePath() once a route is picked,
    // so the picker payload stays small even with many routes.
    const rows: RouteRow[] = (data ?? []).map((r: RouteRow) => ({
      id: r.id,
      route_number: r.route_number,
      display_number: r.display_number,
      description: r.description,
      active: r.active,
      locked: r.locked,
      version: r.version,
      updated_at: r.updated_at,
    }));

    if (rows.length > 0) {
      await db.routes.bulkPut(rows);
    }
    return { rows, source: 'remote' };
  } catch (err) {
    const fallback = await db.routes.toArray();
    return {
      rows: fallback.filter((r) => r.active),
      source: 'cache',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadRouteStops(routeId: string): Promise<CachedFetchResult<RouteStopRow>> {
  if (!isSupabaseConfigured) {
    const local = await db.route_stops.where('route_id').equals(routeId).sortBy('sequence');
    return { rows: local, source: 'cache' };
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('route_stops')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence');
    if (error) throw error;

    const rows = (data ?? []) as RouteStopRow[];
    if (rows.length > 0) await db.route_stops.bulkPut(rows);
    return { rows, source: 'remote' };
  } catch (err) {
    const fallback = await db.route_stops.where('route_id').equals(routeId).sortBy('sequence');
    return {
      rows: fallback,
      source: 'cache',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadRoutePath(routeId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('routes')
      .select('path_geojson, version, updated_at')
      .eq('id', routeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return;
    const existing = await db.routes.get(routeId);
    if (!existing) return;
    await db.routes.put({
      ...existing,
      version: data.version ?? existing.version,
      updated_at: data.updated_at ?? existing.updated_at,
      path_geojson: data.path_geojson ?? null,
    });
  } catch {
    // Offline / transient — driver still has the cached path if previously loaded.
  }
}

export async function loadActiveBuses(): Promise<CachedFetchResult<BusRow>> {
  if (!isSupabaseConfigured) {
    return { rows: await db.buses.toArray(), source: 'cache' };
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('buses')
      .select('id, bus_code, rego, active')
      .eq('active', true)
      .order('bus_code');
    if (error) throw error;

    const rows = (data ?? []) as BusRow[];
    if (rows.length > 0) await db.buses.bulkPut(rows);
    return { rows, source: 'remote' };
  } catch (err) {
    const fallback = (await db.buses.toArray()).filter((b) => b.active);
    return {
      rows: fallback,
      source: 'cache',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
