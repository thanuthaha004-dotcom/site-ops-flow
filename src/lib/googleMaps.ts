import { useEffect, useRef, useState } from 'react';

const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

let loadPromise: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (loadPromise) return loadPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error('Google Maps browser key missing'));

  loadPromise = new Promise((resolve, reject) => {
    (window as any).__lovableInitMap = () => resolve((window as any).google);
    const s = document.createElement('script');
    const channel = TRACKING_ID ? `&channel=${TRACKING_ID}` : '';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__lovableInitMap${channel}&libraries=places`;
    s.async = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState(!!(typeof window !== 'undefined' && (window as any).google?.maps));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (ready) return;
    loadGoogleMaps().then(() => setReady(true)).catch((e) => setError(e.message));
  }, [ready]);
  return { ready, error };
}

export { loadGoogleMaps };

/** Small hook for imperative single-map init. */
export function useMapContainer() {
  return useRef<HTMLDivElement | null>(null);
}
