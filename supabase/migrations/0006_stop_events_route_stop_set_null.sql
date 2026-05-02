-- stop_events.route_stop_id was ON DELETE RESTRICT, which made route_stops
-- impossible to delete once a route had been driven (every shift writes a
-- stop_event for each waypoint, including turns). That meant admins couldn't
-- re-import or re-edit production routes — saves silently failed with
-- "violates foreign key constraint stop_events_route_stop_id_fkey" even
-- though the routes table version still bumped, making it look like the
-- edits had reverted.
--
-- Switch to ON DELETE SET NULL: stop_events keep the shift_id, arrived_at,
-- pickup_count and note (the Vic Bus Safety Reg 31 retention data), but the
-- pointer to a now-deleted route_stop is set to NULL rather than blocking
-- the parent delete. Audit replays that need route_stop context fall back
-- to the shift's polyline + lat/lng on stop_events when the link is null.

ALTER TABLE public.stop_events
  ALTER COLUMN route_stop_id DROP NOT NULL;

ALTER TABLE public.stop_events
  DROP CONSTRAINT stop_events_route_stop_id_fkey;

ALTER TABLE public.stop_events
  ADD CONSTRAINT stop_events_route_stop_id_fkey
  FOREIGN KEY (route_stop_id)
  REFERENCES public.route_stops(id)
  ON DELETE SET NULL;
