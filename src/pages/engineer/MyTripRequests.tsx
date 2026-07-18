import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, addDays } from 'date-fns';
import {
  CalendarIcon, Loader2, MapPin, Users, Clock, Truck, UserCog,
  CheckCircle2, PlayCircle, Send, ClipboardList, FolderKanban, Package,
} from 'lucide-react';
import { parseMaterialNotes, directionLabel } from '@/lib/materialTransport';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  fetchMyTripRequests,
  fetchRequestLiveStatuses,
  type DailyTripRequest,
  type RequestLiveStatus,
} from '@/lib/tripRequestsData';

const statusMeta: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pending:     { label: 'Pending',      cls: 'bg-muted text-muted-foreground',                 Icon: ClipboardList },
  assigned:    { label: 'Assigned',     cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', Icon: Send },
  in_progress: { label: 'In Progress',  cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Icon: PlayCircle },
  completed:   { label: 'Completed',    cls: 'bg-success/15 text-success',                      Icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] || statusMeta.pending;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.cls}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

export default function MyTripRequests() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [requests, setRequests] = useState<DailyTripRequest[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<Map<string, RequestLiveStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const reqs = await fetchMyTripRequests(dateStr, user.id);
      const ordered = [...reqs].sort(
        (a, b) => (a.execution_order ?? 9999) - (b.execution_order ?? 9999),
      );
      setRequests(ordered);
      const live = await fetchRequestLiveStatuses(dateStr, ordered);
      setLiveStatuses(live);
    } catch {
      setRequests([]);
      setLiveStatuses(new Map());
    } finally {
      setLoading(false);
    }
  }, [dateStr, user]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const s = { total: requests.length, pending: 0, assigned: 0, in_progress: 0, completed: 0 };
    requests.forEach(r => {
      const live = liveStatuses.get(r.id);
      const status = live?.status || 'pending';
      s[status] = (s[status] || 0) + 1;
    });
    return s;
  }, [requests, liveStatuses]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Trip Requests</h1>
        <p className="text-muted-foreground text-sm">Browse all your submitted trips and track their progress on any day.</p>
      </div>

      {/* Date picker — same arrow pattern as Submit Trip Requests */}
      <div className="kpi-card flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Trip Date:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">
            ←
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'EEEE, MMM d, yyyy')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={d => d && setSelectedDate(d)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">
            →
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90">
            Today
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && requests.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="kpi-card text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{summary.pending}</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xs text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.assigned}</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.in_progress}</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-success">{summary.completed}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="kpi-card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : requests.length === 0 ? (
        <div className="kpi-card text-center py-12">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold">No Requests Submitted</h2>
          <p className="text-sm text-muted-foreground mt-1">
            You haven't submitted any trip requests for {format(selectedDate, 'MMM d, yyyy')}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r, idx) => {
            const live = liveStatuses.get(r.id);
            const status = live?.status || 'pending';
            const vehicle = live?.vehicle_number || r.vehicle_number;
            const slot = live?.time_slot || (r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : null);
            const material = parseMaterialNotes(r.notes);
            return (
              <div key={r.id} className="kpi-card space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      #{r.execution_order ?? idx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{r.project_name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {r.site || '—'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Workers ({r.worker_names?.length || 0})</p>
                      <p className="font-medium">
                        {r.worker_names?.length ? r.worker_names.join(', ') : <span className="italic text-muted-foreground">No workers — {r.notes || 'reason not specified'}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Pickup</p>
                      <p className="font-medium">{r.pickup_location || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Vehicle</p>
                      <p className="font-medium">{vehicle || <span className="italic text-muted-foreground">Not assigned</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <UserCog className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Driver</p>
                      <p className="font-medium">{r.driver_name || <span className="italic text-muted-foreground">Not assigned</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Time Slot</p>
                      <p className="font-medium">{slot || <span className="italic text-muted-foreground">—</span>}</p>
                    </div>
                  </div>
                  {(live?.started_at || live?.completed_at) && (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Progress</p>
                        <p className="font-medium">
                          {live.started_at && <>Started {format(new Date(live.started_at), 'HH:mm')}</>}
                          {live.completed_at && <> • Completed {format(new Date(live.completed_at), 'HH:mm')}</>}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {r.notes && r.worker_names?.length > 0 && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2">
                    <span className="font-medium">Notes:</span> {r.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
