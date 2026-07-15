import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface DriverLocation {
  user_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_kmh: number | null;
  updated_at: string;
  driver_name: string;
  vehicle_number: string | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

async function fetchAllDriverLocations(): Promise<DriverLocation[]> {
  const { data: locs, error } = await supabase
    .from('driver_locations')
    .select('user_id, lat, lng, accuracy_m, speed_kmh, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const userIds = (locs || []).map((l) => l.user_id);
  if (userIds.length === 0) return [];
  const [{ data: vehicles }, { data: profiles }] = await Promise.all([
    supabase.from('vehicles').select('number, driver, driver_user_id').in('driver_user_id', userIds),
    supabase.from('profiles').select('id, full_name, email').in('id', userIds),
  ]);
  const vehByUser = new Map((vehicles || []).map((v: any) => [v.driver_user_id, v]));
  const profByUser = new Map((profiles || []).map((p: any) => [p.id, p]));
  return (locs || []).map((l: any) => {
    const v = vehByUser.get(l.user_id);
    const p = profByUser.get(l.user_id);
    return {
      ...l,
      driver_name: p?.full_name || v?.driver || p?.email || 'Unknown',
      vehicle_number: v?.number ?? null,
    };
  });
}

export default function LiveFleet() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    fetchAllDriverLocations().then(setLocations).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  // Load map + initial fetch
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        mapObj.current = new google.maps.Map(mapRef.current, {
          center: { lat: 25.1972, lng: 55.2744 }, // Dubai
          zoom: 10,
          streetViewControl: false,
          mapTypeControl: false,
        });
        refresh();
      })
      .catch((e) => { setError(e.message); setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel('driver-locations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!mapObj.current || !(window as any).google) return;
    const google = (window as any).google;
    const seen = new Set<string>();
    for (const l of locations) {
      seen.add(l.user_id);
      const stale = Date.now() - new Date(l.updated_at).getTime() > 5 * 60_000;
      const color = stale ? '#94a3b8' : '#f59e0b';
      let m = markers.current.get(l.user_id);
      if (!m) {
        m = new google.maps.Marker({
          map: mapObj.current,
          title: `${l.driver_name} · ${l.vehicle_number ?? ''}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 8,
          },
        });
        const info = new google.maps.InfoWindow();
        m.addListener('click', () => {
          info.setContent(
            `<div style="font-family:system-ui;font-size:13px;">
              <strong>${l.driver_name}</strong><br/>
              ${l.vehicle_number ?? 'No vehicle'}<br/>
              <span style="color:#64748b">Updated ${timeAgo(l.updated_at)}</span>
            </div>`
          );
          info.open({ anchor: m, map: mapObj.current });
        });
        markers.current.set(l.user_id, m);
      }
      m.setPosition({ lat: l.lat, lng: l.lng });
      m.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 8,
      });
    }
    // Remove stale markers
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) { m.setMap(null); markers.current.delete(id); }
    }
  }, [locations]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-accent" /> Live Fleet
          </h1>
          <p className="text-sm text-muted-foreground">Real-time positions from drivers with the app open.</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-lg border overflow-hidden bg-muted" style={{ height: '70vh' }}>
          <div ref={mapRef} className="w-full h-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <aside className="border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {locations.length} driver{locations.length !== 1 ? 's' : ''} reporting
          </div>
          <ul className="divide-y max-h-[65vh] overflow-y-auto">
            {locations.map((l) => {
              const stale = Date.now() - new Date(l.updated_at).getTime() > 5 * 60_000;
              return (
                <li
                  key={l.user_id}
                  className="p-3 hover:bg-muted/40 cursor-pointer"
                  onClick={() => {
                    mapObj.current?.panTo({ lat: l.lat, lng: l.lng });
                    mapObj.current?.setZoom(14);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stale ? 'bg-slate-400' : 'bg-amber-500'}`} />
                    <span className="font-medium text-sm">{l.driver_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {l.vehicle_number ?? 'No vehicle assigned'} · updated {timeAgo(l.updated_at)}
                  </div>
                </li>
              );
            })}
            {locations.length === 0 && !loading && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                No drivers sharing location yet.
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
