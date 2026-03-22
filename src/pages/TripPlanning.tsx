import { useState, useMemo } from 'react';
import {
  TripGroup, TripWorker, TripStats,
  optimizeTrips, getSampleTripWorkers, TIME_SLOTS, suggestVehicleType, MIN_UTILIZATION,
  excelTimeToString, snapToTimeSlot, getAreaCluster,
} from '@/lib/tripPlanning';
import { Progress } from '@/components/ui/progress';
import {
  Bus, Users, MapPin, Clock, Zap, AlertTriangle, CheckCircle2, Upload,
  BarChart3, TrendingUp, Merge, Shield,
} from 'lucide-react';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export default function TripPlanning() {
  const [workers, setWorkers] = useState<TripWorker[]>(getSampleTripWorkers);
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [activeSlot, setActiveSlot] = useState<string>('All');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: '', site: '', department: '', timeSlot: '5:30 AM', urgent: false });

  const handleOptimize = () => {
    const result = optimizeTrips(workers);
    setTripGroups(result.groups);
    setStats(result.stats);
    toast({ title: `Optimized into ${result.groups.length} trips`, description: `${result.stats.tripsSaved} trips saved, ${result.stats.avgUtilization}% avg utilization` });
  };

  const handleDispatch = (groupId: string) => {
    setTripGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'dispatched' } : g));
    toast({ title: 'Trip dispatched!' });
  };

  const handleDispatchAll = () => {
    setTripGroups(prev => prev.map(g => ({ ...g, status: 'dispatched' })));
    toast({ title: 'All trips dispatched!' });
  };

  const handleAddWorker = () => {
    if (!newWorker.name || !newWorker.site) return;
    const w: TripWorker = {
      id: `TW-${Date.now()}`,
      ...newWorker,
    };
    setWorkers(prev => [...prev, w]);
    setNewWorker({ name: '', site: '', department: '', timeSlot: '5:30 AM', urgent: false });
    setShowAddWorker(false);
    toast({ title: `${w.name} added to ${w.site}` });
  };

  const handleExcelImport = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const imported: TripWorker[] = [];
      let currentDriver = '';

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 7) continue;
        if (row[1]) currentDriver = String(row[1]).trim();

        const passengers = row[11] ? String(row[11]).split(',').map(s => s.trim()).filter(Boolean) : [];
        const endLocation = row[9] ? String(row[9]).trim() : '';
        const startTime = typeof row[5] === 'number' ? row[5] : 0;

        if (!endLocation || endLocation === 'ROOM' || endLocation === 'OFFICE') continue;

        passengers.forEach((name, idx) => {
          if (!name) return;
          imported.push({
            id: `TW-IMP-${i}-${idx}`,
            name,
            site: endLocation,
            department: row[4] ? String(row[4]).trim() : 'General',
            timeSlot: snapToTimeSlot(startTime),
          });
        });
      }

      // Deduplicate by name+site+timeSlot
      const unique = new Map<string, TripWorker>();
      imported.forEach(w => {
        const key = `${w.name.toUpperCase()}-${getAreaCluster(w.site)}-${w.timeSlot}`;
        if (!unique.has(key)) unique.set(key, w);
      });

      setWorkers(Array.from(unique.values()));
      toast({ title: `Imported ${unique.size} worker assignments from Excel` });
    } catch {
      toast({ title: 'Failed to parse Excel file', variant: 'destructive' });
    }
  };

  const filteredGroups = activeSlot === 'All'
    ? tripGroups
    : tripGroups.filter(g => g.timeSlot === activeSlot);

  const workersBySlot = useMemo(() => {
    const map: Record<string, number> = {};
    TIME_SLOTS.forEach(s => { map[s] = workers.filter(w => w.timeSlot === s).length; });
    return map;
  }, [workers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Trip Planning</h1>
          <p className="text-muted-foreground text-sm">{workers.length} workers assigned • {tripGroups.length} trips planned</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExcelUploadButton label="Import Trips" onFileSelect={handleExcelImport} />
          <button
            onClick={() => setShowAddWorker(!showAddWorker)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
          >
            <Users className="h-4 w-4" /> Assign Worker
          </button>
          <button
            onClick={handleOptimize}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors"
          >
            <Zap className="h-4 w-4" /> Optimize
          </button>
          {tripGroups.length > 0 && tripGroups.some(g => g.status !== 'dispatched') && (
            <button
              onClick={handleDispatchAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> Dispatch All
            </button>
          )}
        </div>
      </div>

      {/* Add Worker Form */}
      {showAddWorker && (
        <div className="kpi-card grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input value={newWorker.name} onChange={e => setNewWorker(p => ({ ...p, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Worker name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Site / Location</label>
            <input value={newWorker.site} onChange={e => setNewWorker(p => ({ ...p, site: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Al Quoz" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Department</label>
            <input value={newWorker.department} onChange={e => setNewWorker(p => ({ ...p, department: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="GAS" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Time Slot</label>
            <select value={newWorker.timeSlot} onChange={e => setNewWorker(p => ({ ...p, timeSlot: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="urgent" checked={newWorker.urgent} onChange={e => setNewWorker(p => ({ ...p, urgent: e.target.checked }))}
              className="rounded border-input" />
            <label htmlFor="urgent" className="text-sm text-muted-foreground">Urgent</label>
          </div>
          <button onClick={handleAddWorker}
            className="px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            Add
          </button>
        </div>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={<Bus className="h-5 w-5 text-accent" />} label="Total Trips" value={String(stats.totalTrips)} />
          <StatCard icon={<Merge className="h-5 w-5 text-success" />} label="Trips Saved" value={String(stats.tripsSaved)} highlight />
          <StatCard icon={<BarChart3 className="h-5 w-5 text-info" />} label="Avg Utilization" value={`${stats.avgUtilization}%`}
            warn={stats.avgUtilization < 70} />
          <StatCard icon={<TrendingUp className="h-5 w-5 text-accent" />} label="Optimized" value={String(stats.optimizedTrips)} />
          <StatCard icon={<AlertTriangle className="h-5 w-5 text-destructive" />} label="Inefficient" value={String(stats.inefficientTrips)}
            warn={stats.inefficientTrips > 0} />
        </div>
      )}

      {/* Time Slot Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...TIME_SLOTS].map(slot => (
          <button key={slot} onClick={() => setActiveSlot(slot)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeSlot === slot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}>
            <Clock className="h-3 w-3" /> {slot}
            {slot !== 'All' && <span className="bg-background/20 text-xs px-1.5 py-0.5 rounded">{workersBySlot[slot] || 0}</span>}
          </button>
        ))}
      </div>

      {/* Worker List (before optimization) */}
      {tripGroups.length === 0 && workers.length > 0 && (
        <div className="kpi-card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> Assigned Workers ({workers.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {workers.map(w => (
              <div key={w.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                <div>
                  <span className="font-medium">{w.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{w.department}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {w.site}
                  <Clock className="h-3 w-3 ml-1" /> {w.timeSlot}
                  {w.urgent && <Shield className="h-3 w-3 text-warning" />}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Click <strong>Optimize</strong> to generate smart trip plans.</p>
        </div>
      )}

      {/* Trip Cards */}
      {filteredGroups.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGroups.map(group => (
            <TripCard key={group.id} group={group} onDispatch={handleDispatch} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight, warn }: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className={`kpi-card flex items-center gap-3 ${warn ? 'border-destructive/40' : highlight ? 'border-success/40' : ''}`}>
      {icon}
      <div>
        <p className={`text-xl font-bold ${warn ? 'text-destructive' : highlight ? 'text-success' : ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TripCard({ group, onDispatch }: { group: TripGroup; onDispatch: (id: string) => void }) {
  const utilizationPct = Math.round(group.utilization * 100);

  return (
    <div className={`kpi-card flex flex-col gap-3 transition-colors ${
      group.isInefficient ? 'border-destructive/50 bg-destructive/5' : 
      group.status === 'dispatched' ? 'border-success/40 bg-success/5' :
      group.merged ? 'border-accent/40' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{group.id}</p>
            {group.merged && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium flex items-center gap-1">
                <Merge className="h-2.5 w-2.5" /> Merged
              </span>
            )}
            {group.isUrgent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">Urgent</span>
            )}
          </div>
          <h3 className="font-semibold mt-0.5">{group.area}</h3>
        </div>
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
          group.status === 'dispatched' ? 'status-active' :
          group.status === 'optimized' ? 'bg-accent/10 text-accent' :
          'status-idle'
        }`}>
          {group.status}
        </span>
      </div>

      {/* Time & Sites */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {group.timeSlot}</span>
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {group.sites.join(' → ')}</span>
      </div>

      {/* Vehicle */}
      {group.suggestedVehicle && (
        <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md">
          <Bus className="h-4 w-4 text-accent" />
          <div>
            <span className="font-medium">{group.suggestedVehicle.number}</span>
            <span className="text-muted-foreground ml-2 text-xs">{group.suggestedVehicle.type} • {group.suggestedVehicle.driver}</span>
          </div>
        </div>
      )}

      {/* Utilization */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Seat Utilization</span>
          <span className={`font-medium ${group.isInefficient ? 'text-destructive' : 'text-success'}`}>{utilizationPct}%</span>
        </div>
        <Progress value={utilizationPct} className={`h-2 ${group.isInefficient ? '[&>div]:bg-destructive' : '[&>div]:bg-success'}`} />
      </div>

      {/* Workers */}
      <div className="text-xs">
        <span className="text-muted-foreground">Workers ({group.workers.length}):</span>
        <p className="mt-1">{group.workers.map(w => w.name).join(', ')}</p>
      </div>

      {/* Inefficiency Warning */}
      {group.isInefficient && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          Below {Math.round(MIN_UTILIZATION * 100)}% capacity — consider merging or marking urgent
        </div>
      )}

      {/* Action */}
      {group.status !== 'dispatched' && (
        <button onClick={() => onDispatch(group.id)}
          className="w-full mt-auto px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Dispatch
        </button>
      )}
    </div>
  );
}
