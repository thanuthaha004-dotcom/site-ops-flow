import { useState, useMemo } from 'react';
import {
  TripGroup, TripWorker, TripStats,
  optimizeTrips, TIME_SLOTS, MIN_UTILIZATION,
  snapToTimeSlot, getAreaCluster,
} from '@/lib/tripPlanning';
import { getProjects, getWorkers } from '@/lib/localStorage';
import { Progress } from '@/components/ui/progress';
import {
  Bus, Users, MapPin, Clock, Zap, AlertTriangle, CheckCircle2,
  BarChart3, TrendingUp, Merge, Shield, UserCog, ShieldCheck,
  Plus, Trash2, Edit3, FolderKanban, ArrowRight,
} from 'lucide-react';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

type ViewRole = 'engineer' | 'admin';
type PlanningStep = 'assign' | 'review' | 'optimize' | 'dispatch';

const STEPS: { key: PlanningStep; label: string; engineerOnly?: boolean; adminOnly?: boolean }[] = [
  { key: 'assign', label: 'Assign Workers' },
  { key: 'review', label: 'Review Assignments' },
  { key: 'optimize', label: 'Optimize Trips', adminOnly: true },
  { key: 'dispatch', label: 'Dispatch', adminOnly: true },
];

export default function TripPlanning() {
  const [role, setRole] = useState<ViewRole>('engineer');
  const [step, setStep] = useState<PlanningStep>('assign');
  const [workers, setWorkers] = useState<TripWorker[]>([]);
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [activeSlot, setActiveSlot] = useState<string>('All');

  // Assignment form state
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [assignTimeSlot, setAssignTimeSlot] = useState(TIME_SLOTS[0]);
  const [assignUrgent, setAssignUrgent] = useState(false);

  const projectList = useMemo(() => getProjects(), []);
  const workerList = useMemo(() => getWorkers(), []);

  const selectedProjectData = projectList.find(p => p.id === selectedProject);

  const handleAssignWorkers = () => {
    if (!selectedProjectData || selectedWorkers.size === 0) {
      toast({ title: 'Select a project and at least one worker', variant: 'destructive' });
      return;
    }

    const newAssignments: TripWorker[] = [];
    selectedWorkers.forEach(wId => {
      const w = workerList.find(x => x.id === wId);
      if (!w) return;
      // Avoid duplicates
      if (workers.some(tw => tw.name === w.name && tw.site === selectedProjectData.site && tw.timeSlot === assignTimeSlot)) return;
      newAssignments.push({
        id: `TW-${Date.now()}-${wId}`,
        name: w.name,
        site: selectedProjectData.site,
        department: w.department,
        timeSlot: assignTimeSlot,
        urgent: assignUrgent,
      });
    });

    setWorkers(prev => [...prev, ...newAssignments]);
    setSelectedWorkers(new Set());
    setAssignUrgent(false);
    toast({ title: `${newAssignments.length} workers assigned to ${selectedProjectData.name}` });
  };

  const handleRemoveWorker = (id: string) => {
    setWorkers(prev => prev.filter(w => w.id !== id));
  };

  const handleOptimize = () => {
    if (workers.length === 0) {
      toast({ title: 'No workers assigned yet', variant: 'destructive' });
      return;
    }
    const result = optimizeTrips(workers);
    setTripGroups(result.groups);
    setStats(result.stats);
    setStep('optimize');
    toast({ title: `Optimized into ${result.groups.length} trips`, description: `${result.stats.tripsSaved} trips saved, ${result.stats.avgUtilization}% avg utilization` });
  };

  const handleDispatch = (groupId: string) => {
    setTripGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'dispatched' } : g));
    toast({ title: 'Trip dispatched!' });
  };

  const handleDispatchAll = () => {
    setTripGroups(prev => prev.map(g => ({ ...g, status: 'dispatched' })));
    setStep('dispatch');
    toast({ title: 'All trips dispatched!' });
  };

  const handleOverrideVehicle = (groupId: string) => {
    // Simple override: cycle through vehicle types
    setTripGroups(prev => prev.map(g => {
      if (g.id !== groupId || !g.suggestedVehicle) return g;
      const newCapacity = g.suggestedVehicle.capacity === 5 ? 13 : 5;
      return {
        ...g,
        suggestedVehicle: { ...g.suggestedVehicle, type: `${newCapacity}-seater`, capacity: newCapacity },
        utilization: g.workers.length / newCapacity,
        isInefficient: (g.workers.length / newCapacity) < MIN_UTILIZATION && !g.isUrgent,
      };
    }));
    toast({ title: 'Vehicle overridden' });
  };

  const handleExcelImport = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const imported: TripWorker[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 7) continue;
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
      const unique = new Map<string, TripWorker>();
      imported.forEach(w => {
        const key = `${w.name.toUpperCase()}-${getAreaCluster(w.site)}-${w.timeSlot}`;
        if (!unique.has(key)) unique.set(key, w);
      });
      setWorkers(Array.from(unique.values()));
      toast({ title: `Imported ${unique.size} worker assignments` });
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

  const workersBySite = useMemo(() => {
    const map: Record<string, TripWorker[]> = {};
    workers.forEach(w => {
      const area = getAreaCluster(w.site);
      if (!map[area]) map[area] = [];
      map[area].push(w);
    });
    return map;
  }, [workers]);

  const visibleSteps = STEPS.filter(s =>
    role === 'admin' ? true : !s.adminOnly
  );

  return (
    <div className="space-y-6">
      {/* Header with Role Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Trip Planning</h1>
          <p className="text-muted-foreground text-sm">
            {workers.length} workers assigned • {tripGroups.length} trips planned
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button onClick={() => { setRole('engineer'); setStep('assign'); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                role === 'engineer' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}>
              <UserCog className="h-4 w-4" /> Engineer
            </button>
            <button onClick={() => { setRole('admin'); setStep('assign'); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-input ${
                role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}>
              <ShieldCheck className="h-4 w-4" /> Admin
            </button>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {visibleSteps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <button
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                step === s.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <span className={`h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold ${
                step === s.key ? 'bg-primary-foreground text-primary' : 'bg-muted-foreground/20 text-muted-foreground'
              }`}>
                {i + 1}
              </span>
              {s.label}
            </button>
            {i < visibleSteps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* ===== STEP 1: ASSIGN ===== */}
      {step === 'assign' && (
        <div className="space-y-4">
          {/* Project Selection + Excel Import */}
          <div className="kpi-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-accent" /> Select Project & Assign Workers
              </h2>
              <ExcelUploadButton label="Import from Excel" onFileSelect={handleExcelImport} />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Project Picker */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select project...</option>
                  {projectList.filter(p => p.status === 'Active' || p.status === 'Scheduled').map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.site}</option>
                  ))}
                </select>
              </div>

              {/* Time Slot */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Trip Time</label>
                <select value={assignTimeSlot} onChange={e => setAssignTimeSlot(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Urgent Toggle */}
              <div className="flex items-end gap-2 pb-0.5">
                <input type="checkbox" id="urgent-assign" checked={assignUrgent}
                  onChange={e => setAssignUrgent(e.target.checked)} className="rounded border-input" />
                <label htmlFor="urgent-assign" className="text-sm text-muted-foreground">Mark as Urgent</label>
              </div>

              {/* Assign Button */}
              <div className="flex items-end">
                <button onClick={handleAssignWorkers}
                  disabled={!selectedProject || selectedWorkers.size === 0}
                  className="w-full px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Assign ({selectedWorkers.size})
                </button>
              </div>
            </div>

            {/* Site info */}
            {selectedProjectData && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md">
                <MapPin className="h-4 w-4 text-accent" />
                <span className="font-medium">{selectedProjectData.name}</span>
                <span className="text-muted-foreground">→ {selectedProjectData.site}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {selectedProjectData.workersAssigned}/{selectedProjectData.workersRequired} workers needed
                </span>
              </div>
            )}

            {/* Worker Selection Grid */}
            {selectedProject && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select workers to assign (click to toggle):</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {workerList.map(w => {
                    const isSelected = selectedWorkers.has(w.id);
                    const isAlreadyAssigned = workers.some(tw => tw.name === w.name);
                    return (
                      <button key={w.id}
                        disabled={isAlreadyAssigned}
                        onClick={() => {
                          setSelectedWorkers(prev => {
                            const next = new Set(prev);
                            if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                            return next;
                          });
                        }}
                        className={`text-left p-2 rounded-md border text-sm transition-colors ${
                          isAlreadyAssigned
                            ? 'border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'border-accent bg-accent/10 text-foreground'
                              : 'border-input bg-background hover:bg-muted/50'
                        }`}>
                        <p className="font-medium text-xs">{w.name}</p>
                        <p className="text-[10px] text-muted-foreground">{w.role} • {w.department}</p>
                        {isAlreadyAssigned && <p className="text-[10px] text-accent">Already assigned</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Current Assignments Summary */}
          {workers.length > 0 && (
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" /> Today's Assignments ({workers.length})
                </h2>
                <button onClick={() => setStep('review')}
                  className="text-sm text-accent hover:underline flex items-center gap-1">
                  Review All <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {/* Grouped by site */}
              <div className="space-y-3">
                {Object.entries(workersBySite).map(([area, ws]) => (
                  <div key={area} className="bg-muted/30 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-accent" /> {area}
                      </span>
                      <span className="text-xs text-muted-foreground">{ws.length} workers</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ws.map(w => (
                        <span key={w.id} className="inline-flex items-center gap-1 text-xs bg-background px-2 py-1 rounded border border-border">
                          {w.name}
                          <span className="text-muted-foreground">{w.timeSlot}</span>
                          {w.urgent && <Shield className="h-2.5 w-2.5 text-warning" />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 2: REVIEW ===== */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Time Slot Filter */}
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

          {/* Workers Table */}
          <div className="kpi-card overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">All Assignments</h2>
              <div className="flex gap-2">
                <button onClick={() => setStep('assign')}
                  className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add More
                </button>
                {role === 'admin' && workers.length > 0 && (
                  <button onClick={handleOptimize}
                    className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Optimize Trips
                  </button>
                )}
                {role === 'engineer' && workers.length > 0 && (
                  <span className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready for Admin Review
                  </span>
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Worker</th>
                  <th className="pb-3 font-medium text-muted-foreground">Site</th>
                  <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Area Cluster</th>
                  <th className="pb-3 font-medium text-muted-foreground">Time Slot</th>
                  <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Dept</th>
                  <th className="pb-3 font-medium text-muted-foreground">Flags</th>
                  <th className="pb-3 font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(activeSlot === 'All' ? workers : workers.filter(w => w.timeSlot === activeSlot)).map(w => (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 font-medium">{w.name}</td>
                    <td className="py-2.5 text-muted-foreground">{w.site}</td>
                    <td className="py-2.5 hidden sm:table-cell">
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">{getAreaCluster(w.site)}</span>
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" /> {w.timeSlot}</span>
                    </td>
                    <td className="py-2.5 hidden sm:table-cell text-muted-foreground text-xs">{w.department}</td>
                    <td className="py-2.5">
                      {w.urgent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">Urgent</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <button onClick={() => handleRemoveWorker(w.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {workers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No workers assigned yet. Go to Step 1 to start assigning.</p>
            )}
          </div>

          {/* Area Summary Cards */}
          {workers.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(workersBySite).map(([area, ws]) => {
                const vehicleSuggestion = ws.length <= 3 ? '5-seater' : '13-seater';
                const capacity = ws.length <= 3 ? 5 : 13;
                const utilization = Math.round((ws.length / capacity) * 100);
                return (
                  <div key={area} className={`kpi-card ${utilization < 70 ? 'border-warning/40' : 'border-success/40'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-accent" /> {area}
                      </span>
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">{ws.length} workers</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Bus className="h-3 w-3" /> Suggested: {vehicleSuggestion}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={utilization} className={`h-1.5 flex-1 ${utilization < 70 ? '[&>div]:bg-warning' : '[&>div]:bg-success'}`} />
                      <span className={`text-xs font-medium ${utilization < 70 ? 'text-warning' : 'text-success'}`}>{utilization}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 3: OPTIMIZE (Admin Only) ===== */}
      {step === 'optimize' && role === 'admin' && (
        <div className="space-y-4">
          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={<Bus className="h-5 w-5 text-accent" />} label="Total Trips" value={String(stats.totalTrips)} />
              <StatCard icon={<Merge className="h-5 w-5 text-success" />} label="Trips Saved" value={String(stats.tripsSaved)} highlight />
              <StatCard icon={<BarChart3 className="h-5 w-5 text-[hsl(var(--info))]" />} label="Avg Utilization" value={`${stats.avgUtilization}%`}
                warn={stats.avgUtilization < 70} />
              <StatCard icon={<TrendingUp className="h-5 w-5 text-accent" />} label="Optimized" value={String(stats.optimizedTrips)} />
              <StatCard icon={<AlertTriangle className="h-5 w-5 text-destructive" />} label="Inefficient" value={String(stats.inefficientTrips)}
                warn={stats.inefficientTrips > 0} />
            </div>
          )}

          {/* Time Slot Filter */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {['All', ...TIME_SLOTS].map(slot => (
                <button key={slot} onClick={() => setActiveSlot(slot)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activeSlot === slot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}>
                  <Clock className="h-3 w-3" /> {slot}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleOptimize}
                className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors flex items-center gap-1">
                <Zap className="h-3 w-3" /> Re-optimize
              </button>
              {tripGroups.some(g => g.status !== 'dispatched') && (
                <button onClick={handleDispatchAll}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Dispatch All
                </button>
              )}
            </div>
          </div>

          {/* Trip Cards */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGroups.map(group => (
              <TripCard key={group.id} group={group} onDispatch={handleDispatch}
                onOverride={handleOverrideVehicle} isAdmin />
            ))}
          </div>
        </div>
      )}

      {/* ===== STEP 4: DISPATCH (Admin Only) ===== */}
      {step === 'dispatch' && role === 'admin' && (
        <div className="space-y-4">
          {stats && (
            <div className="kpi-card border-success/40 bg-success/5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <div>
                  <h2 className="font-semibold text-lg">All Trips Dispatched</h2>
                  <p className="text-sm text-muted-foreground">
                    {stats.totalTrips} trips • {workers.length} workers • {stats.avgUtilization}% avg utilization • {stats.tripsSaved} trips saved
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {tripGroups.map(group => (
              <TripCard key={group.id} group={group} onDispatch={() => {}} isAdmin={false} />
            ))}
          </div>
        </div>
      )}

      {/* Engineer: show message after review */}
      {step === 'review' && role === 'engineer' && workers.length > 0 && (
        <div className="kpi-card border-accent/30 bg-accent/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-accent" />
            <div>
              <p className="font-medium">Assignments ready for admin</p>
              <p className="text-sm text-muted-foreground">
                Switch to <strong>Admin view</strong> to optimize and dispatch trips, or continue assigning more workers.
              </p>
            </div>
          </div>
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

function TripCard({ group, onDispatch, onOverride, isAdmin }: {
  group: TripGroup; onDispatch: (id: string) => void;
  onOverride?: (id: string) => void; isAdmin?: boolean;
}) {
  const utilizationPct = Math.round(group.utilization * 100);

  return (
    <div className={`kpi-card flex flex-col gap-3 transition-colors ${
      group.isInefficient ? 'border-destructive/50 bg-destructive/5' :
      group.status === 'dispatched' ? 'border-success/40 bg-success/5' :
      group.merged ? 'border-accent/40' : ''
    }`}>
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
          group.status === 'optimized' ? 'bg-accent/10 text-accent' : 'status-idle'
        }`}>{group.status}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {group.timeSlot}</span>
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {group.sites.join(' → ')}</span>
      </div>

      {group.suggestedVehicle && (
        <div className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-accent" />
            <div>
              <span className="font-medium">{group.suggestedVehicle.number}</span>
              <span className="text-muted-foreground ml-2 text-xs">{group.suggestedVehicle.type} • {group.suggestedVehicle.driver}</span>
            </div>
          </div>
          {isAdmin && group.status !== 'dispatched' && onOverride && (
            <button onClick={() => onOverride(group.id)}
              className="text-[10px] text-accent hover:underline flex items-center gap-0.5">
              <Edit3 className="h-2.5 w-2.5" /> Override
            </button>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Seat Utilization</span>
          <span className={`font-medium ${group.isInefficient ? 'text-destructive' : 'text-success'}`}>{utilizationPct}%</span>
        </div>
        <Progress value={utilizationPct} className={`h-2 ${group.isInefficient ? '[&>div]:bg-destructive' : '[&>div]:bg-success'}`} />
      </div>

      <div className="text-xs">
        <span className="text-muted-foreground">Workers ({group.workers.length}):</span>
        <p className="mt-1">{group.workers.map(w => w.name).join(', ')}</p>
      </div>

      {group.isInefficient && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          Below {Math.round(MIN_UTILIZATION * 100)}% capacity — consider merging or marking urgent
        </div>
      )}

      {isAdmin && group.status !== 'dispatched' && (
        <button onClick={() => onDispatch(group.id)}
          className="w-full mt-auto px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Dispatch
        </button>
      )}
    </div>
  );
}
