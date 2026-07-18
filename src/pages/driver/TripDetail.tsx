import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Loader2, ArrowLeft, MapPin, Users, Truck, Play, Pause, CheckCircle2, AlertCircle, Clock,
  Navigation, FolderKanban, UserCog, StickyNote, Package, AlertTriangle, Timer, MessageSquareWarning,
} from 'lucide-react';
import { parseMaterialNotes, directionLabel } from '@/lib/materialTransport';
import { toast } from '@/hooks/use-toast';
import {
  fetchDriverTrip, startTrip, completeTrip,
  startSegment, pauseSegment, resumeSegment, completeSegment,
  segmentActiveSeconds, tripActiveSeconds, formatDuration,
  type DriverTrip, type TripSegment,
} from '@/lib/driverData';
import ReportIssueDialog from '@/components/driver/ReportIssueDialog';
import { fetchTripIssueNotes, type TripIssueNote } from '@/lib/tripIssueNotes';

function segStatusPill(s: TripSegment['status']) {
  const map = {
    pending: 'bg-muted text-muted-foreground',
    in_progress: 'bg-accent/15 text-accent',
    paused: 'bg-warning/15 text-warning',
    completed: 'bg-primary/15 text-primary',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${map[s]}`}>{s.replace('_',' ')}</span>;
}

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [notes, setNotes] = useState<TripIssueNote[]>([]);

  const reloadNotes = async () => {
    if (!id) return;
    try { setNotes(await fetchTripIssueNotes(id)); } catch {}
  };

  const reload = async () => {
    if (!id) return;
    const t = await fetchDriverTrip(id);
    setTrip(t);
    await reloadNotes();
  };
    if (!id) return;
    const t = await fetchDriverTrip(id);
    setTrip(t);
  };

  useEffect(() => {
    if (!id) return;
    fetchDriverTrip(id)
      .then(t => { setTrip(t); if (!t) setError('Trip not found or access denied.'); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Live timer tick
  useEffect(() => {
    const i = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !trip) return <div className="p-6 text-sm text-destructive">{error || 'Not found'}</div>;

  const material = parseMaterialNotes(trip.notes);
  const passengers = material.isMaterial
    ? []
    : (trip.worker_name || '').split(',').map(s => s.trim()).filter(Boolean);
  const materialCategory = (trip as any).work_type || (trip as any).department || '';
  const segments = trip.segments;
  const allSegmentsCompleted = segments.length > 0 && segments.every(s => s.status === 'completed');
  const tripCompleted = trip.status === 'completed';
  const tripStarted = !!trip.started_at && !tripCompleted;

  const handle = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setBusy(key);
    try {
      await fn();
      await reload();
      toast({ title: successMsg });
    } catch (e: any) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Trips
      </Link>

      {/* Header */}
      <div className="kpi-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{trip.trip_date} · {trip.time_slot}</p>
            <h1 className="text-xl font-bold mt-1">{trip.project_name || trip.site}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {material.isMaterial && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <Package className="h-3.5 w-3.5" /> {directionLabel(material.direction)}
                </span>
              )}
              {(trip.is_urgent || trip.urgent) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Urgent
                </span>
              )}
              {trip.expected_completion_time && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  <Timer className="h-3.5 w-3.5" /> Expected completion {trip.expected_completion_time}
                </span>
              )}
            </div>
          </div>
          {tripCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          )}

        </div>

        {/* Pickup → Drop-off */}
        <div className="rounded-md border border-border bg-muted/30 px-3 py-3 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Navigation className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pickup point</p>
              <p className="font-medium">{trip.pickup_location || 'Al Quoz Labour Camp'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Drop-off</p>
              <p className="font-medium">
                {segments.length > 0 ? segments.map(s => s.site).join(' → ') : trip.site}
              </p>
            </div>
          </div>
        </div>

        {/* Project + Engineer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-start gap-2 text-muted-foreground">
            <FolderKanban className="h-4 w-4 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold">Project</p>
              <p className="font-medium text-foreground">{trip.project_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <UserCog className="h-4 w-4 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold">Engineer</p>
              <p className="font-medium text-foreground">{trip.engineer_name || '—'}</p>
            </div>
          </div>
          {trip.vehicle_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" /> {trip.vehicle_number}{trip.vehicle_type ? ` · ${trip.vehicle_type}` : ''}
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            {material.isMaterial ? (
              <><Package className="h-4 w-4" /> {materialCategory || 'Material'}</>
            ) : (
              <><Users className="h-4 w-4" /> {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>

        {material.isMaterial && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-amber-600" />
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Material Transport</p>
            </div>
            <p className="text-sm text-foreground">
              <span className="font-semibold">{directionLabel(material.direction)}</span>
              {materialCategory ? <> · Category: <span className="font-medium">{materialCategory}</span></> : null}
            </p>
          </div>
        )}

        {!material.isMaterial && passengers.length > 0 && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Passengers</p>
            <p>{passengers.join(', ')}</p>
          </div>
        )}

        {material.cleanNotes && material.cleanNotes.trim() && (
          <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote className="h-3.5 w-3.5 text-accent" />
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">Engineer's Note</p>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{material.cleanNotes}</p>
          </div>
        )}


        {/* Live duration */}
        {(tripStarted || tripCompleted) && (
          <div className="flex items-center gap-2 text-sm font-mono bg-accent/5 border border-accent/20 px-3 py-2 rounded-md">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground text-xs">Trip duration:</span>
            <span className="font-semibold">{formatDuration(tripActiveSeconds(trip, Date.now() + tick * 0))}</span>
          </div>
        )}

        {/* Trip-level controls */}
        <div className="flex flex-wrap gap-2 pt-1">
          {!tripStarted && !tripCompleted && (
            <button
              disabled={busy === 'start-trip'}
              onClick={() => handle('start-trip', () => startTrip(trip.id), 'Trip started')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
              <Play className="h-4 w-4" /> Start Trip
            </button>
          )}
          {tripStarted && !tripCompleted && (
            <button
              disabled={busy === 'complete-trip' || (segments.length > 0 && !allSegmentsCompleted)}
              onClick={() => handle('complete-trip', () => completeTrip(trip.id), 'Trip completed')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              title={segments.length > 0 && !allSegmentsCompleted ? 'Complete every site segment first' : ''}>
              <CheckCircle2 className="h-4 w-4" /> Complete Trip
            </button>
          )}
          {segments.length > 0 && !allSegmentsCompleted && tripStarted && (
            <p className="w-full text-xs text-warning flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Complete every site below before completing the trip.
            </p>
          )}
        </div>
      </div>

      {/* Segments / single site */}
      {segments.length === 0 ? (
        <div className="kpi-card">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-accent mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{trip.site}</p>
              <p className="text-xs text-muted-foreground mt-1">Single-site trip — use the trip controls above.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Site segments</h2>
          {segments.map((seg, idx) => {
            const active = seg.status === 'in_progress';
            const paused = seg.status === 'paused';
            const done = seg.status === 'completed';
            const liveSec = segmentActiveSeconds(seg, Date.now() + tick * 0);
            return (
              <div key={seg.id} className="kpi-card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{seg.site}</p>
                        {segStatusPill(seg.status)}
                      </div>
                      {seg.project_name && <p className="text-xs text-muted-foreground mt-0.5">{seg.project_name}</p>}
                    </div>
                  </div>
                </div>

                {(seg.started_at || done) && (
                  <div className="text-xs font-mono text-muted-foreground">
                    Active time: <span className="font-semibold text-foreground">{formatDuration(liveSec)}</span>
                  </div>
                )}

                {!done && tripStarted && (
                  <div className="flex flex-wrap gap-2">
                    {seg.status === 'pending' && (
                      <button disabled={busy === 'seg-' + seg.id}
                        onClick={() => handle('seg-' + seg.id, () => startSegment(seg.id), 'Segment started')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 disabled:opacity-50">
                        <Play className="h-3.5 w-3.5" /> Start
                      </button>
                    )}
                    {active && (
                      <>
                        <button disabled={busy === 'seg-' + seg.id}
                          onClick={() => handle('seg-' + seg.id, () => pauseSegment(seg.id), 'Segment paused')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-warning/15 text-warning text-xs font-semibold hover:bg-warning/25 disabled:opacity-50">
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </button>
                        <button disabled={busy === 'seg-' + seg.id}
                          onClick={() => handle('seg-' + seg.id, () => completeSegment(seg), 'Segment completed')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </button>
                      </>
                    )}
                    {paused && (
                      <>
                        <button disabled={busy === 'seg-' + seg.id}
                          onClick={() => handle('seg-' + seg.id, () => resumeSegment(seg), 'Segment resumed')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 disabled:opacity-50">
                          <Play className="h-3.5 w-3.5" /> Resume
                        </button>
                        <button disabled={busy === 'seg-' + seg.id}
                          onClick={() => handle('seg-' + seg.id, () => completeSegment(seg), 'Segment completed')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </button>
                      </>
                    )}
                  </div>
                )}
                {!tripStarted && !done && (
                  <p className="text-xs text-muted-foreground">Start the trip to enable this segment.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
