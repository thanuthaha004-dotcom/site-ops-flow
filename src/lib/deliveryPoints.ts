import { supabase } from '@/integrations/supabase/client';

export interface DeliveryPoint {
  id: string;
  name: string;
}

export async function fetchDeliveryPoints(): Promise<DeliveryPoint[]> {
  const { data, error } = await supabase
    .from('delivery_points')
    .select('id, name')
    .order('name');
  if (error) throw error;
  return (data || []) as DeliveryPoint[];
}

export async function addDeliveryPoint(name: string, createdBy: string): Promise<DeliveryPoint> {
  const clean = name.trim();
  if (!clean) throw new Error('Delivery point name is required');
  const { data, error } = await supabase
    .from('delivery_points')
    .insert({ name: clean, created_by: createdBy })
    .select('id, name')
    .single();
  if (error) throw error;
  return data as DeliveryPoint;
}
