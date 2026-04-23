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
  // Engineer suggestions (optional; dispatcher can override)
  start_time?: string | null;
  end_time?: string | null;
  vehicle_number?: string | null;
  vehicle_type?: string | null;
  driver_name?: string | null;
}

export interface TripRequestInput {
  project_id: string;
  project_name: string;
  site: string;
  worker_names: string[];
  work_type: string;
  priority: string;
  notes?: string;
  start_time?: string | null;
  end_time?: string | null;
  vehicle_number?: string | null;
  vehicle_type?: string | null;
  driver_name?: string | null;
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

export interface RequestLiveStatus {
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  vehicle_number: string | null;
  time_slot: string | null;
}

/**
 * Match each engineer request to its dispatched trip(s) on the same date and
 * derive a live status. Match key: project_id (or project_name) + site + at
 * least one overlapping worker name. If multiple trip rows match, the
 * "furthest along" status wins (completed > in_progress > assigned).
 */
export async function fetchRequestLiveStatuses(
  date: string,
  requests: DailyTripRequest[]
): Promise<Map<string, RequestLiveStatus>> {
  const result = new Map<string, RequestLiveStatus>();
  if (requests.length === 0) return result;

  const { data, error } = await supabase
    .from('trip_schedules')
    .select('project_id, project_name, site, worker_name, status, started_at, completed_at, vehicle_number, time_slot')
    .eq('trip_date', date);
  if (error) throw error;

  const norm = (s: string) => (s || '').trim().toUpperCase();
  const rank = (s: string) =>
    s === 'completed' ? 3 : s === 'in_progress' ? 2 : s === 'assigned' ? 1 : 0;

  requests.forEach(req => {
    const reqWorkers = new Set((req.worker_names || []).map(norm));
    const matches = (data || []).filter(r => {
      if (norm(r.site) !== norm(req.site)) return false;
      const projMatches = req.project_id
        ? r.project_id === req.project_id
        : norm(r.project_name) === norm(req.project_name);
      if (!projMatches) return false;
      const tripWorkers = (r.worker_name || '').split(',').map(n => norm(n)).filter(Boolean);
      return tripWorkers.some(n => reqWorkers.has(n));
    });
    if (matches.length === 0) return;
    const best = matches.reduce((acc, r) => (rank(r.status) > rank(acc.status) ? r : acc));
    result.set(req.id, {
      status: best.status as RequestLiveStatus['status'],
      started_at: best.started_at,
      completed_at: best.completed_at,
      vehicle_number: best.vehicle_number,
      time_slot: best.time_slot,
    });
  });
  return result;
}

/**
 * Build a Set of keys identifying workers whose trip on the given date is
 * already completed. Key format: `${projectKey}::${siteUpper}::${nameUpper}`
 * where projectKey is project_id when present, else uppercased project_name.
 * Use {@link buildCompletedWorkerKey} to form a matching lookup key.
 */
export async function fetchCompletedWorkerKeys(date: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const { data, error } = await supabase
    .from('trip_schedules')
    .select('project_id, project_name, site, worker_name, status')
    .eq('trip_date', date)
    .eq('status', 'completed');
  if (error) throw error;
  const norm = (s: string) => (s || '').trim().toUpperCase();
  (data || []).forEach(r => {
    const projectKey = r.project_id || norm(r.project_name);
    const siteKey = norm(r.site);
    (r.worker_name || '').split(',').map(n => norm(n)).filter(Boolean).forEach(n => {
      keys.add(`${projectKey}::${siteKey}::${n}`);
    });
  });
  return keys;
}

export function buildCompletedWorkerKey(
  projectId: string | null | undefined,
  projectName: string | null | undefined,
  site: string,
  workerName: string,
): string {
  const norm = (s: string) => (s || '').trim().toUpperCase();
  const projectKey = projectId || norm(projectName || '');
  return `${projectKey}::${norm(site)}::${norm(workerName)}`;
}

export async function updateRequestStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('daily_trip_requests')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
