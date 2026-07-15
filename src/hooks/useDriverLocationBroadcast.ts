import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DISMISS_KEY = 'driver-location-dismissed';
const MIN_UPLOAD_INTERVAL_MS = 25_000; // ~30s cadence
const MIN_MOVE_METERS = 75;

export type LocationStatus =
  | 'unsupported'
  | 'unknown'
  | 'prompt'
  | 'denied'
  | 'granted'
  | 'error';

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}

/**
 * Broadcasts the driver's current phone GPS to `driver_locations` roughly every 30 s
 * while the app tab is open. Requires the user to grant browser location permission.
 */
export function useDriverLocationBroadcast(enabled: boolean) {
  const { user } = useAuth();
  const [status, setStatus] = useState<LocationStatus>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const dismissedRef = useRef<boolean>(
    typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  );

  // Query permission state up-front
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    const nav = navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } };
    if (nav.permissions?.query) {
      nav.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((res) => {
          setStatus(res.state as LocationStatus);
          res.onchange = () => setStatus(res.state as LocationStatus);
        })
        .catch(() => setStatus('prompt'));
    } else {
      setStatus('prompt');
    }
  }, []);

  const push = useCallback(async (pos: GeolocationPosition) => {
    if (!user) return;
    const { latitude, longitude, accuracy, speed, heading } = pos.coords;
    const now = Date.now();
    const prev = lastPosRef.current;
    if (prev) {
      const moved = haversineMeters(prev, { lat: latitude, lng: longitude });
      if (now - prev.at < MIN_UPLOAD_INTERVAL_MS && moved < MIN_MOVE_METERS) return;
    }
    lastPosRef.current = { lat: latitude, lng: longitude, at: now };
    const { error } = await supabase.from('driver_locations').upsert({
      user_id: user.id,
      lat: latitude,
      lng: longitude,
      accuracy_m: accuracy ?? null,
      speed_kmh: speed != null ? Math.max(0, speed) * 3.6 : null,
      heading: heading ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setLastError(error.message);
    } else {
      setLastError(null);
      setLastSentAt(new Date());
    }
  }, [user]);

  // Start / stop watchPosition
  useEffect(() => {
    if (!enabled || !user) return;
    if (status !== 'granted') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      push,
      (err) => {
        setLastError(err.message);
        if (err.code === err.PERMISSION_DENIED) setStatus('denied');
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
    );
    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [enabled, user, status, push]);

  const requestPermission = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('granted');
        void push(pos);
      },
      (err) => {
        setLastError(err.message);
        if (err.code === err.PERMISSION_DENIED) setStatus('denied');
        else setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, [push]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    dismissedRef.current = true;
  }, []);

  return {
    status,
    lastError,
    lastSentAt,
    requestPermission,
    dismiss,
    dismissed: dismissedRef.current,
  };
}
