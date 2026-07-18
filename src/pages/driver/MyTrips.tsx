import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPin, Users, Truck, Clock, ChevronRight, Calendar, FolderKanban, UserCog, Navigation, CheckCircle2, PlayCircle, StickyNote, Package } from 'lucide-react';
import { fetchDriverTrips, tripActiveSeconds, formatDuration, type DriverTrip } from '@/lib/driverData';
import { parseMaterialNotes, directionLabel } from '@/lib/materialTransport';

function statusPill(status: string) {
  const map: Record<string, string> = {
    assigned: 'bg-muted text-muted-foreground',
    in_progress: 'bg-accent/15 text-accent',
    paused: 'bg-warning/15 text-warning',
    completed: 'bg-primary/15 text-primary',
  };
  const label = status.replace('_', ' ');
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${map[status] || map.assigned}`}>{label}</span>;
}

function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function MyTrips() {
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDriverTrips()
      .then(setTrips)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  // Group by trip_date
  const grouped = trips.reduce<Record<string, DriverTrip[]>>((acc, t) => {
    (acc[t.trip_date] ||= []).push(t);
    return acc;
  }, {});
  // Sort each date's trips by Trip No (engineer's execution order), falling back to time slot.
  Object.values(grouped).forEach(list => list.sort((a, b) => {
    const ao = a.execution_order ?? 9999;
    const bo = b.execution_order ?? 9999;
    if (ao !== bo) return ao - bo;
    return (a.time_slot || '').localeCompare(b.time_slot || '');
  }));
  const dates = Object.keys(grouped).sort();

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Trips</h1>
        <p className="text-sm text-muted-foreground">Trips assigned to you for today and the next 7 days.</p>
      </div>

      {trips.length === 0 && (
        <div className="kpi-card text-center py-12">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No trips assigned yet.</p>
        </div>
      )}

      {dates.map(date => (
        <section key={date} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Calendar className="h-4 w-4" /> {formatDate(date)}
          </h2>
          <div className="space-y-2">
            {grouped[date].map(trip => {
              const material = parseMaterialNotes(trip.notes);
              const passengers = material.isMaterial
                ? []
                : (trip.worker_name || '').split(',').map(s => s.trim()).filter(Boolean);
              const materialCategory = (trip as any).work_type || (trip as any).department || '';
              const dropoff = trip.segments.length > 0
                ? trip.segments.map(s => s.site).join(' → ')
                : trip.site;
              const projectLabel = trip.segments.length > 1
                ? [...new Set(trip.segments.map(s => s.project_name).filter(Boolean))].join(' · ')
                : (trip.project_name || '—');
              return (
                <Link key={trip.id} to={`/trip/${trip.id}`}
                  className="kpi-card flex items-start gap-3 hover:border-accent transition-colors group">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {trip.execution_order != null && (
                        <span className="inline-flex items-center justify-center h-6 min-w-[2rem] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          #{trip.execution_order}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> {trip.time_slot}
                      </span>
                      {statusPill(trip.status)}
                      {trip.segments.length > 1 && (
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {trip.segments.length} stops
                        </span>
                      )}
                    </div>
                    {/* Pickup → Drop-off */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Navigation className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <span className="text-xs uppercase tracking-wide font-semibold">Pickup:</span>
                        <span className="font-medium text-foreground">{trip.pickup_location || 'Al Quoz Labour Camp'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Drop:</span>
                        <span className="font-medium">{dropoff}</span>
                      </div>
                    </div>
                    {/* Project + Engineer */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {projectLabel}</span>
                      {trip.engineer_name && (
                        <span className="flex items-center gap-1"><UserCog className="h-3.5 w-3.5" /> {trip.engineer_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}</span>
                      {trip.vehicle_number && (
                        <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {trip.vehicle_number}</span>
                      )}
                    </div>
                    {trip.notes && trip.notes.trim() && (
                      <div className="rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 flex items-start gap-1.5">
                        <StickyNote className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                        <span className="text-xs text-foreground line-clamp-2"><span className="font-semibold">Note:</span> {trip.notes}</span>
                      </div>
                    )}
                    {/* Live progress: started / completed / duration */}
                    {(trip.started_at || trip.completed_at) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-1.5 border-t border-border/60">
                        {trip.started_at && (
                          <span className="flex items-center gap-1 text-accent">
                            <PlayCircle className="h-3.5 w-3.5" />
                            Started {new Date(trip.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {trip.completed_at && (
                          <span className="flex items-center gap-1 text-success font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Completed {new Date(trip.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {trip.started_at && (
                          <span className="text-muted-foreground">
                            • {formatDuration(tripActiveSeconds(trip))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors mt-1" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
