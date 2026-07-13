import { supabase } from '@/integrations/supabase/client';
import { setCustomZoneMappings } from '@/lib/tripPlanning';

export interface ZoneLocationRow {
  id: string;
  zone: string;
  location_keyword: string;
  created_at: string;
}

export const ZONE_LIST = [
  'Zone 1',
  'Zone 2',
  'Zone 3',
  'Zone 4',
  'Hub - Al Quoz Camp',
  'Sharjah',
  'Ajman',
  'Al Ain',
  'Abu Dhabi',
];

let cache: ZoneLocationRow[] | null = null;
let inflight: Promise<ZoneLocationRow[]> | null = null;

export async function loadZoneMappings(force = false): Promise<ZoneLocationRow[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from('zone_locations')
      .select('id, zone, location_keyword, created_at')
      .order('zone', { ascending: true });
    if (error) throw error;
    const rows = (data || []) as ZoneLocationRow[];
    cache = rows;
    setCustomZoneMappings(rows);
    return rows;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function clearZoneMappingsCache() {
  cache = null;
}
