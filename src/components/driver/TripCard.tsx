import { Link } from 'react-router-dom';
import { MapPin, Users, Truck, Clock, ChevronRight, FolderKanban, UserCog, Navigation, CheckCircle2, PlayCircle, StickyNote, Package } from 'lucide-react';
import { tripActiveSeconds, formatDuration, type DriverTrip } from '@/lib/driverData';
import { parseMaterialNotes, directionLabel } from '@/lib/materialTransport';

function statusPill(status: string) {
  const map: Record<string, string> = {
    assigned: 'bg-muted text-muted-foreground',
    in_progress: 'bg-accent/15 text-accent',
    paused: 'bg-warning/15 text-warning',
    completed: 'bg-success/15 text-success',
  };
  const label = status.replace('_', ' ');
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${map[status] || map.assigned}`}>{label}</span>;
}

export default function TripCard({ trip }: { trip: DriverTrip }) {
  const material = parseMaterialNotes(trip.notes);
  const passengers = material.isMaterial
    ? []
    : (trip.worker_name || '').split(',').map(s => s.trim()).filter(Boolean);
  const dropoff = trip.segments.length > 0
    ? trip.segments.map(s => s.site).join(' → ')
    : trip.site;
  const projectLabel = trip.segments.length > 1
    ? [...new Set(trip.segments.map(s => s.project_name).filter(Boolean))].join(' · ')
    : (trip.project_name || '—');
  // work_type on the schedule row carries the material category for
  // material trips (engineer entered category is stored there).
  const materialCategory = (trip as any).work_type || (trip as any).department || '';

  return (
    <Link to={`/trip/${trip.id}`} className="kpi-card flex items-start gap-3 hover:border-accent transition-colors group">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {trip.time_slot}
          </span>
          {statusPill(trip.status)}
          {trip.segments.length > 1 && (
            <span className="text-[10px] font-semibold uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {trip.segments.length} stops
            </span>
          )}
          {material.isMaterial && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Package className="h-3 w-3" /> {directionLabel(material.direction)}
            </span>
          )}
        </div>
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {projectLabel}</span>
          {trip.engineer_name && (
            <span className="flex items-center gap-1"><UserCog className="h-3.5 w-3.5" /> {trip.engineer_name}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {material.isMaterial ? (
            <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {materialCategory || 'Material'}</span>
          ) : (
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}</span>
          )}
          {trip.vehicle_number && (
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {trip.vehicle_number}</span>
          )}
        </div>
        {material.cleanNotes && material.cleanNotes.trim() && (
          <div className="rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 flex items-start gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
            <span className="text-xs text-foreground line-clamp-2"><span className="font-semibold">Note:</span> {material.cleanNotes}</span>
          </div>
        )}

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
}
