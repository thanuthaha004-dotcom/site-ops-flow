import { supabase } from '@/integrations/supabase/client';

export interface TripSegment {
  id: string;
  trip_id: string;
  sequence: number;
  site: string;
  project_id: string | null;
  project_name: string;
  engineer_name?: string;
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
  engineer_name: string;
  pickup_location: string;
  worker_name: string;
  vehicle_number: string | null;
  vehicle_type: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string;
  execution_order: number | null;
  expected_completion_time?: string | null;
  is_urgent?: boolean | null;
  urgent?: boolean | null;
  segments: TripSegment[];
}

/** Fetch trips assigned to the current driver for the past 7 days + next 7 days. */
export async function fetchDriverTrips(): Promise<DriverTrip[]> {
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data: trips, error } = await supabase
    .from('trip_schedules')
    .select('*')
    .gte('trip_date', start)
    .lte('trip_date', end)
    .order('trip_date', { ascending: false })
    .order('execution_order', { ascending: true, nullsFirst: false })
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
    engineer_name: t.engineer_name || '',
    pickup_location: t.pickup_location || 'Al Quoz Labour Camp',
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
  return {
    ...(data as any),
    engineer_name: (data as any).engineer_name || '',
    pickup_location: (data as any).pickup_location || 'Al Quoz Labour Camp',
    segments: (segs || []) as TripSegment[],
  };
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

// ── Admin: pending user approvals (drivers & engineers) ──

export interface PendingDriver {
  user_id: string;
  full_name: string;
  email: string;
  role_id: string;
}

export type ApprovableRole = 'driver' | 'engineer';

export async function fetchPendingApprovals(role: ApprovableRole): Promise<PendingDriver[]> {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('id, user_id, role, pending')
    .eq('role', role)
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

// Back-compat wrapper for driver-only callers.
export async function fetchPendingDrivers(): Promise<PendingDriver[]> {
  return fetchPendingApprovals('driver');
}

export async function approveUser(roleId: string) {
  const { error } = await supabase.from('user_roles')
    .update({ pending: false }).eq('id', roleId);
  if (error) throw error;
}

export async function rejectUser(roleId: string) {
  const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
  if (error) throw error;
}

// Aliases kept so existing driver-approval imports keep working.
export const approveDriver = approveUser;
export const rejectDriver = rejectUser;

export interface DirectoryUser {
  user_id: string;
  role_id: string;
  full_name: string;
  email: string;
  pending: boolean;
}

/** All users with the given role (both approved and pending). */
export async function fetchAllUsersByRole(role: ApprovableRole): Promise<DirectoryUser[]> {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('id, user_id, pending')
    .eq('role', role);
  if (error) throw error;
  if (!roles?.length) return [];

  const ids = roles.map(r => r.user_id);
  const { data: profs } = await supabase
    .from('profiles').select('id, full_name, email').in('id', ids);
  const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

  return roles.map((r: any) => ({
    user_id: r.user_id,
    role_id: r.id,
    full_name: profMap.get(r.user_id)?.full_name || '',
    email: profMap.get(r.user_id)?.email || '',
    pending: !!r.pending,
  })).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Trigger a Supabase password-reset email for a user account. */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
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

// ── Driver Attendance (derived from trip_schedules) ──

export interface DriverAttendanceRecord {
  driverName: string;
  vehicleNumber: string;
  date: string;
  checkIn: string | null;   // HH:MM (earliest started_at)
  checkOut: string | null;  // HH:MM (latest completed_at)
  tripsCount: number;
  hours: number;
  overtime: number;
}

/**
 * Derive driver attendance from completed/in-progress trips over a date range.
 * Check-in = earliest started_at on that date for the driver.
 * Check-out = latest completed_at on that date for the driver.
 */
export async function fetchDriverAttendance(daysBack: number = 7): Promise<DriverAttendanceRecord[]> {
  const today = new Date();
  const start = new Date(today.getTime() - (daysBack - 1) * 86400000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = today.toISOString().slice(0, 10);

  // Get trips with started_at in window (need vehicle_number to map to driver)
  const { data: trips, error } = await supabase
    .from('trip_schedules')
    .select('trip_date, vehicle_number, started_at, completed_at, status')
    .gte('trip_date', startStr)
    .lte('trip_date', endStr)
    .not('started_at', 'is', null);
  if (error) throw error;
  if (!trips?.length) return [];

  // Map vehicle_number -> driver name (via vehicles + profiles)
  const vehNumbers = [...new Set(trips.map((t: any) => t.vehicle_number).filter(Boolean))];
  if (vehNumbers.length === 0) return [];

  const { data: vehs } = await supabase
    .from('vehicles')
    .select('number, driver, driver_user_id')
    .in('number', vehNumbers);

  const driverUserIds = (vehs || []).map((v: any) => v.driver_user_id).filter(Boolean);
  const { data: profs } = driverUserIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', driverUserIds)
    : { data: [] };
  const profMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));

  const vehMap = new Map<string, string>();
  (vehs || []).forEach((v: any) => {
    const name = profMap.get(v.driver_user_id) || v.driver || '';
    if (name) vehMap.set(v.number, name);
  });

  // Bucket per (driver, date)
  type Bucket = { driverName: string; vehicleNumber: string; date: string; starts: number[]; ends: number[]; tripsCount: number };
  const buckets = new Map<string, Bucket>();

  trips.forEach((t: any) => {
    const driverName = vehMap.get(t.vehicle_number);
    if (!driverName) return;
    const key = `${driverName}||${t.trip_date}`;
    const startTs = t.started_at ? new Date(t.started_at).getTime() : null;
    const endTs = t.completed_at ? new Date(t.completed_at).getTime() : null;
    const b = buckets.get(key) || { driverName, vehicleNumber: t.vehicle_number, date: t.trip_date, starts: [], ends: [], tripsCount: 0 };
    if (startTs) b.starts.push(startTs);
    if (endTs) b.ends.push(endTs);
    b.tripsCount += 1;
    buckets.set(key, b);
  });

  const fmt = (ts: number | null) => ts == null ? null
    : new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return Array.from(buckets.values()).map(b => {
    const inTs = b.starts.length ? Math.min(...b.starts) : null;
    const outTs = b.ends.length ? Math.max(...b.ends) : null;
    const hours = inTs && outTs ? Math.max(0, (outTs - inTs) / 3600000) : 0;
    const overtime = Math.max(0, hours - 8);
    return {
      driverName: b.driverName,
      vehicleNumber: b.vehicleNumber,
      date: b.date,
      checkIn: fmt(inTs),
      checkOut: fmt(outTs),
      tripsCount: b.tripsCount,
      hours,
      overtime,
    };
  }).sort((a, b) => (a.date === b.date ? a.driverName.localeCompare(b.driverName) : b.date.localeCompare(a.date)));
}
