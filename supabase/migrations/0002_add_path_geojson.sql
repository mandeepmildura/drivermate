-- Add path_geojson to routes so the admin map editor can store a road-following
-- LineString. Nullable: existing routes without a drawn line fall back to
-- connecting route_stops in sequence on the client side.

ALTER TABLE drivermate.routes
  ADD COLUMN IF NOT EXISTS path_geojson jsonb;

COMMENT ON COLUMN drivermate.routes.path_geojson IS
  'GeoJSON Feature<LineString> of the full road-following route geometry, drawn in the admin editor. Null until admin draws the line.';
