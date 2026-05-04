import { useEffect, useState } from 'react';
import { getSimulatedPosition, subscribeSimulator, type SimulatedPosition } from './simulator';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export type GeoStatus =
  | { kind: 'idle' }
  | { kind: 'unsupported' }
  | { kind: 'permission_denied' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'fix'; position: GeoPosition; lastFixAt: number };

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

function simulatedToStatus(sim: SimulatedPosition): GeoStatus {
  return {
    kind: 'fix',
    position: {
      lat: sim.lat,
      lng: sim.lng,
      accuracy: 5,
      heading: sim.heading ?? null,
      speed: 0,
      timestamp: Date.now(),
    },
    // Wall-clock at the moment this status was constructed. We use this for
    // gap detection rather than position.timestamp because iOS PWAs can
    // report stale position.timestamp values after backgrounding.
    lastFixAt: Date.now(),
  };
}

export function useGeolocation(enabled: boolean): GeoStatus {
  const [status, setStatus] = useState<GeoStatus>({ kind: 'idle' });

  useEffect(() => {
    // Even with GPS toggled off the user might be running the simulator
    // (admin testing, ?sim=1 sandbox), and the simulator hard-overrides
    // real GPS by definition. Honour any active simulated position before
    // bailing out, so the "GPS off" toggle only mutes real-device tracking.
    if (!enabled) {
      const sim = getSimulatedPosition();
      if (sim) {
        setStatus(simulatedToStatus(sim));
        const unsub = subscribeSimulator(() => {
          const next = getSimulatedPosition();
          if (next) setStatus(simulatedToStatus(next));
          else setStatus({ kind: 'idle' });
        });
        return unsub;
      }
      setStatus({ kind: 'idle' });
      return;
    }

    let watchId: number | null = null;

    const stopRealWatch = () => {
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const startRealWatch = () => {
      if (watchId !== null) return;
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus({ kind: 'unsupported' });
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (getSimulatedPosition()) return; // simulator took over mid-flight
          setStatus({
            kind: 'fix',
            position: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            },
            // Wall-clock at the moment the callback fires. iOS PWA Safari
            // can return a stale pos.timestamp after backgrounding, so we
            // never use that for gap detection — only Date.now() at this
            // call site is trustworthy.
            lastFixAt: Date.now(),
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
    };

    const apply = () => {
      const sim = getSimulatedPosition();
      if (sim) {
        stopRealWatch();
        setStatus(simulatedToStatus(sim));
      } else {
        startRealWatch();
      }
    };

    apply();
    const unsub = subscribeSimulator(apply);

    return () => {
      unsub();
      stopRealWatch();
    };
  }, [enabled]);

  return status;
}
