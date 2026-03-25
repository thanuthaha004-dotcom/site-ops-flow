import { supabase } from '@/integrations/supabase/client';

export interface DailyTripRequest {
  id: string;
  trip_date: string;
  engineer_id: string;
  engineer_name: string;
  project_id: string;
  project_name: string;
  site: string;
  worker_names: string[];
  work_type: string;
  priority: string;
  status: string;
  notes: string;
  created_at: string;
}

export async function fetchTripRequestsByDate(date: string): Promise<DailyTripRequest[]> {
  const { data, error } = await supabase
    .from('daily_trip_requests')
    .select('*')
    .eq('trip_date', date)
    .order('created_at');
  if (error) throw error;
  return (data || []) as DailyTripRequest[];
}

export async function fetchMyTripRequests(date: string, engineerId: string): Promise<DailyTripRequest[]> {
  const { data, error } = await supabase
    .from('daily_trip_requests')
    .select('*')
    .eq('trip_date', date)
    .eq('engineer_id', engineerId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as DailyTripRequest[];
}

export async function submitTripRequests(
  date: string,
  engineerId: string,
  engineerName: string,
  requests: { project_id: string; project_name: string; site: string; worker_names: string[]; work_type: string; priority: string; notes?: string }[]
): Promise<void> {
  // Delete existing requests by this engineer for this date
  await supabase
    .from('daily_trip_requests')
    .delete()
    .eq('trip_date', date)
    .eq('engineer_id', engineerId);

  if (requests.length === 0) return;

  const rows = requests.map(r => ({
    trip_date: date,
    engineer_id: engineerId,
    engineer_name: engineerName,
    project_id: r.project_id,
    project_name: r.project_name,
    site: r.site,
    worker_names: r.worker_names,
    work_type: r.work_type,
    priority: r.priority,
    notes: r.notes || '',
    status: 'pending',
  }));

  const { error } = await supabase.from('daily_trip_requests').insert(rows);
  if (error) throw error;
}

export async function updateRequestStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('daily_trip_requests')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
