import { supabase } from '@/integrations/supabase/client';

export interface DailyTripRequest {
  id: string;
  trip_date: string;
  engineer_id: string;
  engineer_name: string;
  project_id: string | null;
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
  pickup_location?: string | null;
  execution_order?: number | null;
  expected_completion_time?: string | null;
  is_urgent?: boolean | null;
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
  pickup_location?: string | null;
  execution_order?: number | null;
  expected_completion_time?: string | null;
  is_urgent?: boolean | null;
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
  requests: TripRequestInput[]
): Promise<void> {
  // APPEND semantics: keep every previously-submitted request for this
  // engineer + date (regardless of status), and add the new rows on top.
  // The engineer's form always starts blank, so submitting only ever adds
  // trips — it never silently deletes prior pending entries.
  const { data: existing } = await supabase
    .from('daily_trip_requests')
    .select('*')
    .eq('trip_date', date)
    .eq('engineer_id', engineerId);

  const existingRows = (existing || []) as DailyTripRequest[];

  if (requests.length === 0) return;

  // Skip new rows that exactly duplicate an existing row (same project + site +
  // overlapping workers) so accidental re-submits don't create dupes.
  const norm = (s: string) => (s || '').trim().toUpperCase();
  const isDuplicate = (r: TripRequestInput) => {
    const newWorkers = new Set((r.worker_names || []).map(norm).filter(Boolean));
    return existingRows.some(p => {
      if (norm(p.site) !== norm(r.site)) return false;
      const projMatches = r.project_id ? p.project_id === r.project_id : norm(p.project_name) === norm(r.project_name);
      if (!projMatches) return false;
      const pWorkers = new Set((p.worker_names || []).map(norm).filter(Boolean));
      if (newWorkers.size === 0 && pWorkers.size === 0) return true;
      for (const n of newWorkers) if (pWorkers.has(n)) return true;
      return false;
    });
  };

  // Continue numbering after the highest existing execution_order.
  const nextOrder = existingRows.reduce(
    (max, r) => Math.max(max, r.execution_order ?? 0),
    0,
  );

  const rows = requests
    .filter(r => !isDuplicate(r))
    .map((r, idx) => ({
      trip_date: date,
      engineer_id: engineerId,
      engineer_name: engineerName,
      project_id: r.project_id || null,
      project_name: r.project_name,
      site: r.site,
      worker_names: r.worker_names,
      work_type: r.work_type,
      priority: r.priority,
      notes: r.notes || '',
      status: 'pending',
      start_time: r.start_time || null,
      end_time: r.end_time || null,
      vehicle_number: r.vehicle_number || null,
      vehicle_type: r.vehicle_type || null,
      driver_name: r.driver_name || null,
      pickup_location: r.pickup_location || 'Al Quoz Labour Camp',
      execution_order: r.execution_order ?? nextOrder + idx + 1,
    }));

  if (rows.length === 0) return;
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

  // Recognize the placeholder used for worker-less (solo / material-only) trips.
  const isPlaceholderWorker = (n: string) =>
    !n || n.includes('NO PERSONNEL') || n.startsWith('—') || n.endsWith('—');

  requests.forEach(req => {
    const reqWorkers = new Set((req.worker_names || []).map(norm).filter(Boolean));
    const matches = (data || []).filter(r => {
      if (norm(r.site) !== norm(req.site)) return false;
      if (req.vehicle_number && r.vehicle_number && norm(r.vehicle_number) !== norm(req.vehicle_number)) return false;
      const projMatches = req.project_id
        ? r.project_id === req.project_id
        : norm(r.project_name) === norm(req.project_name);
      if (!projMatches) return false;
      const tripWorkers = (r.worker_name || '').split(',').map(n => norm(n)).filter(Boolean);
      // Worker-less request: match any trip on same project+site that is also
      // worker-less (placeholder) — these are the dispatched solo trips.
      if (reqWorkers.size === 0) {
        return tripWorkers.length === 0 || tripWorkers.every(isPlaceholderWorker);
      }
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
