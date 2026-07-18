import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VehicleOccupancy {
  vehicle_number: string;
  passenger_count: number;
  material_percent: number;
  updated_by: string | null;
  updated_at: string;
}

export const MATERIAL_OPTIONS = [0, 25, 50, 75, 100] as const;

export async function fetchOccupancyForVehicle(vehicleNumber: string): Promise<VehicleOccupancy | null> {
  const { data, error } = await supabase
    .from('vehicle_occupancy')
    .select('*')
    .eq('vehicle_number', vehicleNumber)
    .maybeSingle();
  if (error) throw error;
  return (data as VehicleOccupancy) ?? null;
}

export async function fetchAllOccupancy(): Promise<VehicleOccupancy[]> {
  const { data, error } = await supabase
    .from('vehicle_occupancy')
    .select('*');
  if (error) throw error;
  return (data || []) as VehicleOccupancy[];
}

export async function upsertOccupancy(input: {
  vehicle_number: string;
  passenger_count: number;
  material_percent: number;
}): Promise<VehicleOccupancy> {
  const { data: userData } = await supabase.auth.getUser();
  const payload = {
    vehicle_number: input.vehicle_number,
    passenger_count: Math.max(0, Math.floor(input.passenger_count)),
    material_percent: input.material_percent,
    updated_by: userData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('vehicle_occupancy')
    .upsert(payload, { onConflict: 'vehicle_number' })
    .select()
    .single();
  if (error) throw error;
  return data as VehicleOccupancy;
}

/** Subscribe to realtime updates on the occupancy table. */
export function useAllOccupancy() {
  const [rows, setRows] = useState<VehicleOccupancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchAllOccupancy()
      .then((r) => { if (mounted) setRows(r); })
      .finally(() => { if (mounted) setLoading(false); });

    const ch = supabase
      .channel('vehicle-occupancy-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_occupancy' },
        () => {
          fetchAllOccupancy().then((r) => { if (mounted) setRows(r); }).catch(() => {});
        }
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  return { rows, loading };
}
