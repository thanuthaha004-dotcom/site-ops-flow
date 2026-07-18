import { supabase } from '@/integrations/supabase/client';

export interface TripIssueNote {
  id: string;
  trip_id: string;
  driver_user_id: string;
  note: string;
  created_at: string;
  driver_name?: string;
}

export async function addTripIssueNote(tripId: string, note: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const trimmed = note.trim();
  if (!trimmed) throw new Error('Note cannot be empty');
  if (trimmed.length > 2000) throw new Error('Note is too long (max 2000 characters)');
  const { error } = await supabase
    .from('trip_issue_notes')
    .insert({ trip_id: tripId, driver_user_id: uid, note: trimmed });
  if (error) throw error;
}

async function attachDriverNames(rows: any[]): Promise<TripIssueNote[]> {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(r => r.driver_user_id))];
  const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
  const map = new Map((profs || []).map((p: any) => [p.id, p.full_name || p.email || '']));
  return rows.map(r => ({ ...r, driver_name: map.get(r.driver_user_id) || '' })) as TripIssueNote[];
}

export async function fetchTripIssueNotes(tripId: string): Promise<TripIssueNote[]> {
  const { data, error } = await supabase
    .from('trip_issue_notes')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachDriverNames(data || []);
}

export async function fetchIssueNotesForTrips(tripIds: string[]): Promise<Map<string, TripIssueNote[]>> {
  const result = new Map<string, TripIssueNote[]>();
  if (!tripIds.length) return result;
  const { data, error } = await supabase
    .from('trip_issue_notes')
    .select('*')
    .in('trip_id', tripIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const withNames = await attachDriverNames(data || []);
  withNames.forEach(n => {
    const arr = result.get(n.trip_id) || [];
    arr.push(n);
    result.set(n.trip_id, arr);
  });
  return result;
}
