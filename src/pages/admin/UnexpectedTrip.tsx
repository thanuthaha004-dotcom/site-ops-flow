import { useState } from 'react';
import { Loader2, Search, MapPin, Navigation, Clock, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Result {
  user_id: string;
  driver_name: string;
  vehicle_number: string | null;
  vehicle_type: string | null;
  lat: number;
  lng: number;
  updated_at: string;
  distance_km: number | null;
  eta_minutes: number | null;
  rough_km: number;
  error: string | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function UnexpectedTrip() {
  const { profileName } = useAuth();
  const [destination, setDestination] = useState('');
  const [site, setSite] = useState('');
  const [worker, setWorker] = useState('');
  const [notes, setNotes] = useState('');
  const [timeSlot, setTimeSlot] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [results, setResults] = useState<Result[]>([]);
  const [dest, setDest] = useState<{ formatted: string; lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const findNearest = async () => {
    if (!destination.trim()) { toast.error('Enter a destination address.'); return; }
    setLoading(true);
    setResults([]);
    setDest(null);
    const { data, error } = await supabase.functions.invoke('find-nearest-vehicles', {
      body: { destination: { address: destination.trim() }, limit: 5 },
    });
    setLoading(false);
    if (error) { toast.error(error.message || 'Failed to find nearest vehicles'); return; }
    if (data?.error) { toast.error(String(data.error)); return; }
    setDest(data.destination);
    setResults(data.results || []);
    setSite((prev) => prev || data.destination.formatted);
    if (!data.results?.length) toast.info('No drivers are currently sharing their location.');
  };

  const assign = async (r: Result) => {
    if (!r.vehicle_number) { toast.error('That driver has no vehicle assigned.'); return; }
    if (!worker.trim()) { toast.error('Enter the worker name to assign.'); return; }
    if (!site.trim()) { toast.error('Enter a site name.'); return; }
    setAssigning(r.user_id);
    const today = new Date();
    const trip_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { error } = await supabase.from('trip_schedules').insert({
      trip_date,
      worker_name: worker.trim(),
      site: site.trim(),
      department: 'Ad-hoc',
      time_slot: timeSlot,
      urgent: true,
      project_name: 'Unexpected trip',
      vehicle_number: r.vehicle_number,
      status: 'pending',
      engineer_name: profileName || 'Dispatch',
      pickup_location: 'Current location',
      notes: notes.trim() || `Nearest-vehicle dispatch · ETA ~${r.eta_minutes ?? '?'} min`,
    });
    setAssigning(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Assigned to ${r.driver_name} (${r.vehicle_number})`);
    setWorker('');
    setNotes('');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Navigation className="h-6 w-6 text-accent" /> Unexpected Trip
        </h1>
        <p className="text-sm text-muted-foreground">
          Find the nearest available driver by live GPS and dispatch immediately.
        </p>
      </header>

      <div className="kpi-card space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination address</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. JLT Cluster D, Dubai"
                onKeyDown={(e) => e.key === 'Enter' && findNearest()}
              />
              <Button onClick={findNearest} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" /> Find</>}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Worker name</label>
            <Input value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="e.g. Ahmed" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time slot</label>
            <Input value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} placeholder="14:30" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site</label>
            <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Auto-filled from destination" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring extra hose" className="mt-1" />
          </div>
        </div>
      </div>

      {dest && (
        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-accent" /> Destination resolved: <span className="font-medium text-foreground">{dest.formatted}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top {results.length} nearest driver{results.length !== 1 ? 's' : ''}
          </h2>
          {results.map((r, i) => (
            <div key={r.user_id} className="kpi-card flex items-center gap-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-accent/15 text-accent font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.driver_name}</span>
                  {r.vehicle_number && (
                    <span className="text-xs px-2 py-0.5 rounded bg-muted flex items-center gap-1">
                      <Truck className="h-3 w-3" /> {r.vehicle_number}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1"><Navigation className="h-3 w-3" />
                    {r.distance_km != null ? `${r.distance_km} km` : `~${r.rough_km} km (straight-line)`}
                  </span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                    {r.eta_minutes != null ? `~${r.eta_minutes} min` : 'ETA n/a'}
                  </span>
                  <span>updated {timeAgo(r.updated_at)}</span>
                  {r.error && <span className="text-warning">· {r.error}</span>}
                </div>
              </div>
              <Button
                size="sm"
                disabled={assigning === r.user_id || !r.vehicle_number}
                onClick={() => assign(r)}
              >
                {assigning === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
