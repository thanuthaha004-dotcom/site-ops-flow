import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BodySchema = z.object({
  destination: z.union([
    z.object({ lat: z.number(), lng: z.number() }),
    z.object({ address: z.string().min(2).max(300) }),
  ]),
  limit: z.number().int().min(1).max(20).optional().default(5),
  max_stale_minutes: z.number().int().min(1).max(1440).optional().default(15),
});

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}

async function geocode(address: string): Promise<{ lat: number; lng: number; formatted: string }> {
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
    { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY! } }
  );
  if (!res.ok) throw new Error(`Geocode failed [${res.status}]: ${await res.text()}`);
  const j = await res.json();
  if (!j.results?.length) throw new Error(`Could not find address: ${address}`);
  const r = j.results[0];
  return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formatted: r.formatted_address };
}

async function computeRouteMatrix(
  origins: { lat: number; lng: number }[],
  dest: { lat: number; lng: number }
): Promise<Array<{ originIndex: number; distance_m?: number; duration_s?: number; error?: string }>> {
  if (origins.length === 0) return [];
  const body = {
    origins: origins.map((o) => ({
      waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
      routeModifiers: { avoid_ferries: true },
    })),
    destinations: [{ waypoint: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } } }],
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };
  const res = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY!,
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`Route matrix failed [${res.status}]: ${await res.text()}`);
    return origins.map((_, i) => ({ originIndex: i, error: 'route_lookup_failed' }));
  }
  const rows = (await res.json()) as Array<{
    originIndex: number;
    distanceMeters?: number;
    duration?: string;
    condition?: string;
    status?: { code?: number };
  }>;
  return rows.map((r) => ({
    originIndex: r.originIndex,
    distance_m: r.distanceMeters,
    duration_s: r.duration ? parseInt(String(r.duration).replace('s', ''), 10) : undefined,
    error: r.condition && r.condition !== 'ROUTE_EXISTS' ? r.condition : undefined,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) throw new Error('Missing Google Maps connector credentials');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { destination, limit, max_stale_minutes } = parsed.data;

    // Resolve destination
    let dest: { lat: number; lng: number; formatted: string };
    if ('address' in destination) dest = await geocode(destination.address);
    else dest = { ...destination, formatted: `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}` };

    // Fetch fresh driver locations + linked vehicle + profile
    const cutoff = new Date(Date.now() - max_stale_minutes * 60_000).toISOString();
    const { data: locs, error: locErr } = await supabase
      .from('driver_locations')
      .select('user_id, lat, lng, accuracy_m, speed_kmh, updated_at')
      .gte('updated_at', cutoff);
    if (locErr) throw locErr;

    const userIds = (locs || []).map((l) => l.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ destination: dest, results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [{ data: vehicles }, { data: profiles }] = await Promise.all([
      supabase.from('vehicles').select('number, type, driver, driver_user_id').in('driver_user_id', userIds),
      supabase.from('profiles').select('id, full_name, email').in('id', userIds),
    ]);

    const vehByUser = new Map((vehicles || []).map((v) => [v.driver_user_id as string, v]));
    const profByUser = new Map((profiles || []).map((p) => [p.id as string, p]));

    // Roughly prefilter: take closest N * 3 by haversine before routing (Routes API bills per element)
    const withRough = (locs || []).map((l) => ({
      loc: l,
      roughKm: haversineKm({ lat: l.lat, lng: l.lng }, dest),
    }));
    withRough.sort((a, b) => a.roughKm - b.roughKm);
    const shortlist = withRough.slice(0, Math.max(limit * 3, 10));

    const matrix = await computeRouteMatrix(
      shortlist.map((s) => ({ lat: s.loc.lat, lng: s.loc.lng })),
      dest
    );

    const results = shortlist.map((s, i) => {
      const veh = vehByUser.get(s.loc.user_id);
      const prof = profByUser.get(s.loc.user_id);
      const m = matrix.find((x) => x.originIndex === i);
      return {
        user_id: s.loc.user_id,
        driver_name: prof?.full_name || veh?.driver || prof?.email || 'Unknown',
        vehicle_number: veh?.number || null,
        vehicle_type: veh?.type || null,
        lat: s.loc.lat,
        lng: s.loc.lng,
        updated_at: s.loc.updated_at,
        rough_km: Number(s.roughKm.toFixed(2)),
        distance_km: m?.distance_m != null ? Number((m.distance_m / 1000).toFixed(2)) : null,
        eta_minutes: m?.duration_s != null ? Math.round(m.duration_s / 60) : null,
        error: m?.error || null,
      };
    });

    results.sort((a, b) => {
      const av = a.eta_minutes ?? 9999;
      const bv = b.eta_minutes ?? 9999;
      if (av !== bv) return av - bv;
      return (a.rough_km ?? 9999) - (b.rough_km ?? 9999);
    });

    return new Response(
      JSON.stringify({ destination: dest, results: results.slice(0, limit) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('find-nearest-vehicles error:', e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
