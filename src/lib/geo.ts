import { useEffect, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type GeoStatus =
  | { kind: 'idle' }
  | { kind: 'unsupported' }
  | { kind: 'permission_denied' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'fix'; position: GeoPosition };

const EARTH_RADIUS_M = 6_371_000;

export function haversineMetres(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function useGeolocation(enabled: boolean): GeoStatus {
  const [status, setStatus] = useState<GeoStatus>({ kind: 'idle' });

  useEffect(() => {
    if (!enabled) {
      setStatus({ kind: 'idle' });
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus({ kind: 'unsupported' });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus({
          kind: 'fix',
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus({ kind: 'permission_denied' });
        } else {
          setStatus({ kind: 'unavailable', message: err.message });
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return status;
}
