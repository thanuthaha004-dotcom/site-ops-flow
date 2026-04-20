import { supabase } from '@/integrations/supabase/client';

export interface TripSegment {
  id: string;
  trip_id: string;
  sequence: number;
  site: string;
  project_id: string | null;
  project_name: string;
  status: 'pending' | 'in_progress' | 'paused' | 'completed';
  started_at: string | null;
  paused_at: string | null;
  total_paused_seconds: number;
  completed_at: string | null;
}

export interface DriverTrip {
  id: string;
  trip_date: string;
  time_slot: string;
  site: string;
  project_id: string | null;
  project_name: string;
  worker_name: string;
  vehicle_number: string | null;
  vehicle_type: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  start_time: string | null;
  end_time: string | null;
  segments: TripSegment[];
}

/** Fetch trips assigned to the current driver for today + next 7 days. */
export async function fetchDriverTrips(): Promise<DriverTrip[]> {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data: trips, error } = await supabase
    .from('trip_schedules')
    .select('*')
    .gte('trip_date', today)
    .lte('trip_date', end)
    .order('trip_date', { ascending: true })
    .order('time_slot', { ascending: true });

  if (error) throw error;
  if (!trips?.length) return [];

  const ids = trips.map(t => t.id);
  const { data: segs, error: segErr } = await supabase
    .from('trip_segments')
    .select('*')
    .in('trip_id', ids)
    .order('sequence', { ascending: true });
  if (segErr) throw segErr;

  const bySegTrip = new Map<string, TripSegment[]>();
  (segs || []).forEach((s: any) => {
    const arr = bySegTrip.get(s.trip_id) || [];
    arr.push(s as TripSegment);
    bySegTrip.set(s.trip_id, arr);
  });

  return trips.map((t: any) => ({
    ...t,
    segments: bySegTrip.get(t.id) || [],
  })) as DriverTrip[];
}

export async function fetchDriverTrip(tripId: string): Promise<DriverTrip | null> {
  const { data, error } = await supabase
    .from('trip_schedules').select('*').eq('id', tripId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: segs, error: segErr } = await supabase
    .from('trip_segments').select('*').eq('trip_id', tripId)
    .order('sequence', { ascending: true });
  if (segErr) throw segErr;
  return { ...(data as any), segments: (segs || []) as TripSegment[] };
}

// ── Trip lifecycle ──

export async function startTrip(tripId: string) {
  const { error } = await supabase.from('trip_schedules')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', tripId);
  if (error) throw error;
}

export async function completeTrip(tripId: string) {
  // Trigger enforces all segments are completed; will throw if not.
  const { error } = await supabase.from('trip_schedules')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', tripId);
  if (error) throw error;
}

// ── Segment lifecycle (with pause tracking) ──

export async function startSegment(segmentId: string) {
  const { error } = await supabase.from('trip_segments')
    .update({ status: 'in_progress', started_at: new Date().toISOString(), paused_at: null })
    .eq('id', segmentId);
  if (error) throw error;
}

export async function pauseSegment(segmentId: string) {
  const { error } = await supabase.from('trip_segments')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', segmentId);
  if (error) throw error;
}

export async function resumeSegment(segment: TripSegment) {
  const pausedSec = segment.paused_at
    ? Math.max(0, Math.floor((Date.now() - new Date(segment.paused_at).getTime()) / 1000))
    : 0;
  const { error } = await supabase.from('trip_segments')
    .update({
      status: 'in_progress',
      paused_at: null,
      total_paused_seconds: (segment.total_paused_seconds || 0) + pausedSec,
    })
    .eq('id', segment.id);
  if (error) throw error;
}

export async function completeSegment(segment: TripSegment) {
  // If currently paused, fold pause time into total before completing.
  const pausedSec = segment.status === 'paused' && segment.paused_at
    ? Math.max(0, Math.floor((Date.now() - new Date(segment.paused_at).getTime()) / 1000))
    : 0;
  const { error } = await supabase.from('trip_segments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      paused_at: null,
      total_paused_seconds: (segment.total_paused_seconds || 0) + pausedSec,
    })
    .eq('id', segment.id);
  if (error) throw error;
}

/** Compute active duration (excluding paused time) in seconds. */
export function segmentActiveSeconds(seg: TripSegment, now: number = Date.now()): number {
  if (!seg.started_at) return 0;
  const end = seg.completed_at ? new Date(seg.completed_at).getTime() : now;
  const elapsed = Math.max(0, Math.floor((end - new Date(seg.started_at).getTime()) / 1000));
  let paused = seg.total_paused_seconds || 0;
  if (seg.status === 'paused' && seg.paused_at && !seg.completed_at) {
    paused += Math.max(0, Math.floor((now - new Date(seg.paused_at).getTime()) / 1000));
  }
  return Math.max(0, elapsed - paused);
}

export function tripActiveSeconds(trip: DriverTrip, now: number = Date.now()): number {
  if (!trip.started_at) return 0;
  const end = trip.completed_at ? new Date(trip.completed_at).getTime() : now;
  const elapsed = Math.max(0, Math.floor((end - new Date(trip.started_at).getTime()) / 1000));
  // Subtract sum of paused seconds across segments (best-effort approximation).
  const paused = (trip.segments || []).reduce((sum, s) => {
    let p = s.total_paused_seconds || 0;
    if (s.status === 'paused' && s.paused_at && !s.completed_at) {
      p += Math.max(0, Math.floor((now - new Date(s.paused_at).getTime()) / 1000));
    }
    return sum + p;
  }, 0);
  return Math.max(0, elapsed - paused);
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Admin: pending driver approvals ──

export interface PendingDriver {
  user_id: string;
  full_name: string;
  email: string;
  role_id: string;
}

export async function fetchPendingDrivers(): Promise<PendingDriver[]> {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('id, user_id, role, pending')
    .eq('role', 'driver')
    .eq('pending', true);
  if (error) throw error;
  if (!roles?.length) return [];

  const userIds = roles.map(r => r.user_id);
  const { data: profs } = await supabase
    .from('profiles').select('id, full_name, email').in('id', userIds);
  const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

  return roles.map((r: any) => ({
    user_id: r.user_id,
    role_id: r.id,
    full_name: profMap.get(r.user_id)?.full_name || '',
    email: profMap.get(r.user_id)?.email || '',
  }));
}

export async function approveDriver(roleId: string) {
  const { error } = await supabase.from('user_roles')
    .update({ pending: false }).eq('id', roleId);
  if (error) throw error;
}

export async function rejectDriver(roleId: string) {
  const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
  if (error) throw error;
}

// Vehicles list (for admin to assign driver_user_id)
export async function fetchDriverUsers(): Promise<{ user_id: string; full_name: string; email: string }[]> {
  const { data: roles, error } = await supabase
    .from('user_roles').select('user_id').eq('role', 'driver').eq('pending', false);
  if (error) throw error;
  if (!roles?.length) return [];
  const ids = roles.map(r => r.user_id);
  const { data: profs } = await supabase
    .from('profiles').select('id, full_name, email').in('id', ids);
  return (profs || []).map((p: any) => ({ user_id: p.id, full_name: p.full_name, email: p.email }));
}
