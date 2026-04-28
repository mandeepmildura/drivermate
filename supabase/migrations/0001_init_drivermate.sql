-- DriverMate: initial schema (reconciled with live database 2026-04-28).
--
-- This file replaces the original drivermate-schema-based migration. The
-- live Supabase project keeps every DriverMate table in `public`, not in
-- a dedicated `drivermate` schema, because the project was rebuilt by
-- hand during the migration off the shared FarmControl database. The
-- file below captures the live shape verbatim so a fresh deployment
-- from these migrations alone reproduces production exactly.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / OR REPLACE; policies and
-- triggers are dropped first. Safe to re-apply against the live DB.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.drivers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_number   text UNIQUE NOT NULL,
  full_name       text NOT NULL,
  is_admin        boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  can_drive_vline boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.buses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_code    text UNIQUE NOT NULL,
  rego        text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.routes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_number    text UNIQUE NOT NULL,
  display_number  text,
  description     text,
  active          boolean NOT NULL DEFAULT true,
  locked          boolean NOT NULL DEFAULT false,
  version         integer NOT NULL DEFAULT 1,
  path_geojson    jsonb,
  service_type    text NOT NULL DEFAULT 'school'
                  CHECK (service_type IN ('school','vline')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.route_stops (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id               uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  sequence               integer NOT NULL,
  stop_name              text NOT NULL,
  scheduled_time         time,
  instruction_text       text,
  instruction_audio_cue  text,
  lat                    double precision,
  lng                    double precision,
  kind                   text NOT NULL DEFAULT 'stop'
                         CHECK (kind IN ('stop','turn')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  route_id            uuid NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
  bus_id              uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  bus_code_override   text,
  started_at          timestamptz NOT NULL,
  ended_at            timestamptz,
  client_created_at   timestamptz NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.shifts IS
  '3-year retention required per Vic Bus Safety Reg. 31. Do not hard-delete.';

CREATE TABLE IF NOT EXISTS public.stop_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  route_stop_id   uuid NOT NULL REFERENCES public.route_stops(id) ON DELETE RESTRICT,
  arrived_at      timestamptz NOT NULL,
  pickup_count    integer NOT NULL DEFAULT 0 CHECK (pickup_count >= 0),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.stop_events IS
  '3-year retention required per Vic Bus Safety Reg. 31. Do not hard-delete.';

CREATE TABLE IF NOT EXISTS public.gps_breadcrumbs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  recorded_at  timestamptz NOT NULL,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  heading      double precision,
  speed        double precision,
  accuracy     double precision,
  synced_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.gps_breadcrumbs IS
  '3-year retention required per Vic Bus Safety Reg. 31. Do not hard-delete.';

CREATE TABLE IF NOT EXISTS public.client_errors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  shift_id      uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL,
  message       text NOT NULL,
  stack         text,
  url           text,
  user_agent    text,
  app_version   text,
  context       jsonb
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS route_stops_route_seq_idx
  ON public.route_stops (route_id, sequence);

CREATE INDEX IF NOT EXISTS shifts_driver_started_idx
  ON public.shifts (driver_id, started_at DESC);

CREATE INDEX IF NOT EXISTS stop_events_shift_idx
  ON public.stop_events (shift_id);

CREATE INDEX IF NOT EXISTS gps_breadcrumbs_shift_idx
  ON public.gps_breadcrumbs (shift_id, recorded_at);

CREATE INDEX IF NOT EXISTS client_errors_driver_idx
  ON public.client_errors (driver_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS client_errors_occurred_idx
  ON public.client_errors (occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.version = OLD.version THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routes_touch ON public.routes;
CREATE TRIGGER routes_touch
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_route();

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.drivers WHERE auth_user_id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.drivers WHERE auth_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_driver_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.drivers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_breadcrumbs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_errors    ENABLE ROW LEVEL SECURITY;

-- Drivers: each user sees own row; admins see all.
DROP POLICY IF EXISTS drivers_self_select ON public.drivers;
CREATE POLICY drivers_self_select ON public.drivers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS drivers_admin_write ON public.drivers;
CREATE POLICY drivers_admin_write ON public.drivers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Buses: read by all authenticated; admin write.
DROP POLICY IF EXISTS buses_read_all ON public.buses;
CREATE POLICY buses_read_all ON public.buses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS buses_admin_write ON public.buses;
CREATE POLICY buses_admin_write ON public.buses
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Routes: read by all authenticated; admin write.
DROP POLICY IF EXISTS routes_read_all ON public.routes;
CREATE POLICY routes_read_all ON public.routes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS routes_admin_write ON public.routes;
CREATE POLICY routes_admin_write ON public.routes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Route stops: read by all authenticated; admin write only on UNLOCKED routes.
-- The unlocked guard makes a "lock route" admin action commit the geometry
-- so no driver can run a route that's still being edited.
DROP POLICY IF EXISTS route_stops_read_all ON public.route_stops;
CREATE POLICY route_stops_read_all ON public.route_stops
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS route_stops_admin_write ON public.route_stops;
CREATE POLICY route_stops_admin_write ON public.route_stops
  FOR ALL TO authenticated
  USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_stops.route_id AND r.locked = false
    )
  )
  WITH CHECK (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_stops.route_id AND r.locked = false
    )
  );

-- Shifts: drivers manage their own; admins read all.
DROP POLICY IF EXISTS shifts_self_rw ON public.shifts;
CREATE POLICY shifts_self_rw ON public.shifts
  FOR ALL TO authenticated
  USING (driver_id = public.current_driver_id() OR public.is_admin())
  WITH CHECK (driver_id = public.current_driver_id());

-- Stop events: tied to driver via shift; admins read all.
DROP POLICY IF EXISTS stop_events_self_rw ON public.stop_events;
CREATE POLICY stop_events_self_rw ON public.stop_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = stop_events.shift_id
        AND (s.driver_id = public.current_driver_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = stop_events.shift_id
        AND s.driver_id = public.current_driver_id()
    )
  );

-- GPS breadcrumbs: tied to driver via shift; admins read all.
DROP POLICY IF EXISTS gps_breadcrumbs_self_rw ON public.gps_breadcrumbs;
CREATE POLICY gps_breadcrumbs_self_rw ON public.gps_breadcrumbs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = gps_breadcrumbs.shift_id
        AND (s.driver_id = public.current_driver_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = gps_breadcrumbs.shift_id
        AND s.driver_id = public.current_driver_id()
    )
  );

-- Client errors: any authenticated session may insert (driver_id either
-- null for pre-login crashes or matching the signed-in driver); only
-- admins can read back the log.
DROP POLICY IF EXISTS client_errors_insert ON public.client_errors;
CREATE POLICY client_errors_insert ON public.client_errors
  FOR INSERT TO authenticated
  WITH CHECK (driver_id IS NULL OR driver_id = public.current_driver_id());

DROP POLICY IF EXISTS client_errors_admin_read ON public.client_errors;
CREATE POLICY client_errors_admin_read ON public.client_errors
  FOR SELECT TO authenticated
  USING (public.is_admin());
