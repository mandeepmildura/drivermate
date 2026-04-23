-- DriverMate: initial schema
--
-- Lives in its own `drivermate` Postgres schema so it does not touch the
-- existing FarmControl / sandysoil tables that share this Supabase project.
--
-- After applying this migration, expose the schema to the API:
--   Supabase dashboard -> Project Settings -> API -> Exposed schemas
--   Add: drivermate

CREATE SCHEMA IF NOT EXISTS drivermate;
GRANT USAGE ON SCHEMA drivermate TO authenticated, anon, service_role;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE drivermate.drivers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_number   text UNIQUE NOT NULL,
  full_name       text NOT NULL,
  is_admin        boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drivermate.buses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_code    text UNIQUE NOT NULL,
  rego        text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drivermate.routes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_number    text UNIQUE NOT NULL,
  display_number  text,
  description     text,
  active          boolean NOT NULL DEFAULT true,
  locked          boolean NOT NULL DEFAULT false,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN drivermate.routes.locked IS
  'When true, driver-affecting route data cannot be edited. Admin must explicitly unlock to revise. Compliance-relevant per Vic Bus Safety Regs 2020.';

CREATE TABLE drivermate.route_stops (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id                uuid NOT NULL REFERENCES drivermate.routes(id) ON DELETE CASCADE,
  sequence                integer NOT NULL,
  kind                    text NOT NULL DEFAULT 'stop' CHECK (kind IN ('stop', 'turn')),
  stop_name               text NOT NULL,
  scheduled_time          time,
  instruction_text        text,
  instruction_audio_cue   text,
  lat                     double precision,
  lng                     double precision,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, sequence)
);
COMMENT ON COLUMN drivermate.route_stops.kind IS
  'stop = passenger pickup/drop with counter; turn = navigation waypoint only (no counter, optional scheduled_time).';

CREATE TABLE drivermate.shifts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid NOT NULL REFERENCES drivermate.drivers(id) ON DELETE RESTRICT,
  route_id            uuid NOT NULL REFERENCES drivermate.routes(id) ON DELETE RESTRICT,
  bus_id              uuid REFERENCES drivermate.buses(id) ON DELETE SET NULL,
  bus_code_override   text,
  started_at          timestamptz NOT NULL,
  ended_at            timestamptz,
  client_created_at   timestamptz NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE drivermate.shifts IS
  '3-year retention required per Vic Bus Safety Reg. 31. Do not hard-delete.';

CREATE TABLE drivermate.stop_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid NOT NULL REFERENCES drivermate.shifts(id) ON DELETE CASCADE,
  route_stop_id   uuid NOT NULL REFERENCES drivermate.route_stops(id) ON DELETE RESTRICT,
  arrived_at      timestamptz NOT NULL,
  pickup_count    integer NOT NULL DEFAULT 0 CHECK (pickup_count >= 0),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE drivermate.stop_events IS
  '3-year retention required per Vic Bus Safety Reg. 31. Do not hard-delete.';

CREATE INDEX shifts_driver_started_idx
  ON drivermate.shifts (driver_id, started_at DESC);

CREATE INDEX stop_events_shift_idx
  ON drivermate.stop_events (shift_id);

CREATE INDEX route_stops_route_seq_idx
  ON drivermate.route_stops (route_id, sequence);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION drivermate.touch_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.version = OLD.version THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER routes_touch
BEFORE UPDATE ON drivermate.routes
FOR EACH ROW
EXECUTE FUNCTION drivermate.touch_route();

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION drivermate.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM drivermate.drivers WHERE auth_user_id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION drivermate.current_driver_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM drivermate.drivers WHERE auth_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION drivermate.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION drivermate.current_driver_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE drivermate.drivers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivermate.buses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivermate.routes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivermate.route_stops  ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivermate.shifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivermate.stop_events  ENABLE ROW LEVEL SECURITY;

-- Drivers: each user sees own row; admins see all
CREATE POLICY drivers_self_select ON drivermate.drivers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR drivermate.is_admin());

CREATE POLICY drivers_admin_write ON drivermate.drivers
  FOR ALL TO authenticated
  USING (drivermate.is_admin())
  WITH CHECK (drivermate.is_admin());

-- Buses: read by all authenticated; admin write
CREATE POLICY buses_read_all ON drivermate.buses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY buses_admin_write ON drivermate.buses
  FOR ALL TO authenticated
  USING (drivermate.is_admin())
  WITH CHECK (drivermate.is_admin());

-- Routes: read by all authenticated; admin write
-- (locking is enforced at the route_stops level — admins can still flip the
-- locked flag itself, that is the whole point of the admin role)
CREATE POLICY routes_read_all ON drivermate.routes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY routes_admin_write ON drivermate.routes
  FOR ALL TO authenticated
  USING (drivermate.is_admin())
  WITH CHECK (drivermate.is_admin());

-- Route stops: read by all authenticated; admin write only when parent route unlocked
CREATE POLICY route_stops_read_all ON drivermate.route_stops
  FOR SELECT TO authenticated USING (true);

CREATE POLICY route_stops_admin_write ON drivermate.route_stops
  FOR ALL TO authenticated
  USING (
    drivermate.is_admin()
    AND EXISTS (
      SELECT 1 FROM drivermate.routes r
      WHERE r.id = route_id AND r.locked = false
    )
  )
  WITH CHECK (
    drivermate.is_admin()
    AND EXISTS (
      SELECT 1 FROM drivermate.routes r
      WHERE r.id = route_id AND r.locked = false
    )
  );

-- Shifts: drivers manage their own; admins read all
CREATE POLICY shifts_self_rw ON drivermate.shifts
  FOR ALL TO authenticated
  USING (driver_id = drivermate.current_driver_id() OR drivermate.is_admin())
  WITH CHECK (driver_id = drivermate.current_driver_id());

-- Stop events: tied to driver via shift; admins read all
CREATE POLICY stop_events_self_rw ON drivermate.stop_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivermate.shifts s
      WHERE s.id = shift_id
        AND (s.driver_id = drivermate.current_driver_id() OR drivermate.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivermate.shifts s
      WHERE s.id = shift_id AND s.driver_id = drivermate.current_driver_id()
    )
  );

-- ---------------------------------------------------------------------------
-- API grants (PostgREST exposes drivermate once added to the API settings)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA drivermate TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA drivermate TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA drivermate
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
