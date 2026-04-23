// Build deep-link URLs into the Google Maps app (or web) for hands-off
// turn-by-turn navigation. We don't embed Google Maps in DriverMate — that
// would need a paid API key. Instead, the driver taps "Navigate" and the
// tablet's Google Maps app opens with the destination preset and uses its
// own GPS / voice guidance.
//
// On Android tablets with Google Maps installed, the URL opens the app
// directly. On other devices it opens maps.google.com in a new tab.

const REGION_QUALIFIER = 'Mildura VIC, Australia';

function encodePlace(stopName: string, lat: number | null, lng: number | null): string {
  if (lat != null && lng != null) return `${lat},${lng}`;
  return encodeURIComponent(`${stopName}, ${REGION_QUALIFIER}`);
}

export function navigateUrlForStop(
  stopName: string,
  lat: number | null,
  lng: number | null,
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodePlace(stopName, lat, lng)}&travelmode=driving&dir_action=navigate`;
}

export interface MapStop {
  stop_name: string;
  lat: number | null;
  lng: number | null;
}

export function navigateUrlForRemainingStops(stops: MapStop[]): string | null {
  if (stops.length === 0) return null;
  const final = stops[stops.length - 1];
  const waypoints = stops
    .slice(0, -1)
    .map((s) => encodePlace(s.stop_name, s.lat, s.lng))
    .join('|');
  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodePlace(final.stop_name, final.lat, final.lng)}&travelmode=driving&dir_action=navigate`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}
