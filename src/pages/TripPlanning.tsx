import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TripGroup, TripWorker, TripStats,
  optimizeTrips, TIME_SLOTS, MIN_UTILIZATION,
  snapToTimeSlot, getAreaCluster,
} from '@/lib/tripPlanning';
import { fetchProjects, fetchWorkers, fetchTripsByDate, saveTripAssignments, getRecentTripDates } from '@/lib/supabaseData';
import type { Project, Worker } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import {
  Bus, Users, MapPin, Clock, Zap, AlertTriangle, CheckCircle2,
  BarChart3, TrendingUp, Merge, Shield, UserCog, ShieldCheck,
  Plus, Trash2, Edit3, FolderKanban, ArrowRight, CalendarIcon, Copy, Save,
} from 'lucide-react';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format, subDays, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type ViewRole = 'engineer' | 'admin';
type PlanningStep = 'assign' | 'review' | 'optimize' | 'dispatch';

const STEPS: { key: PlanningStep; label: string; engineerOnly?: boolean; adminOnly?: boolean }[] = [
  { key: 'assign', label: 'Assign Workers' },
  { key: 'review', label: 'Review Assignments' },
  { key: 'optimize', label: 'Optimize Trips', adminOnly: true },
  { key: 'dispatch', label: 'Dispatch', adminOnly: true },
];

function toDateStr(d: Date) { return format(d, 'yyyy-MM-dd'); }

export default function TripPlanning() {
  const [role, setRole] = useState<ViewRole>('engineer');
  const [step, setStep] = useState<PlanningStep>('assign');
  const [workers, setWorkers] = useState<TripWorker[]>([]);
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [activeSlot, setActiveSlot] = useState<string>('All');

  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [assignTimeSlot, setAssignTimeSlot] = useState(TIME_SLOTS[0]);
  const [assignStartTime, setAssignStartTime] = useState('');
  const [assignEndTime, setAssignEndTime] = useState('');
  const [assignUrgent, setAssignUrgent] = useState(false);

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [workerList, setWorkerList] = useState<Worker[]>([]);

  // Date-based scheduling
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [recentDates, setRecentDates] = useState<string[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProjects().then(setProjectList).catch(() => {});
    fetchWorkers().then(setWorkerList).catch(() => {});
    getRecentTripDates().then(setRecentDates).catch(() => {});
  }, []);

  // Load trips when date changes
  const loadTripsForDate = useCallback(async (date: Date) => {
    setLoadingTrips(true);
    try {
      const rows = await fetchTripsByDate(toDateStr(date));
      const loaded: TripWorker[] = rows.map((r, i) => ({
        id: `TW-DB-${r.id}`,
        name: r.worker_name,
        site: r.site,
        department: r.department,
        timeSlot: r.time_slot,
        startTime: r.start_time || '',
        endTime: r.end_time || '',
        urgent: r.urgent,
      }));
      setWorkers(loaded);
      setTripGroups([]);
      setStats(null);
      setStep('assign');
      setSaved(rows.length > 0);
    } catch {
      toast({ title: 'Failed to load trips for this date', variant: 'destructive' });
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => { loadTripsForDate(selectedDate); }, [selectedDate, loadTripsForDate]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) setSelectedDate(date);
  };

  const handleCopyFromDate = async (fromDateStr: string) => {
    try {
      const rows = await fetchTripsByDate(fromDateStr);
      if (rows.length === 0) {
        toast({ title: 'No trips found on that date', variant: 'destructive' });
        return;
      }
      const copied: TripWorker[] = rows.map((r, i) => ({
        id: `TW-COPY-${Date.now()}-${i}`,
        name: r.worker_name,
        site: r.site,
        department: r.department,
        timeSlot: r.time_slot,
        urgent: r.urgent,
      }));
      setWorkers(copied);
      setSaved(false);
      toast({ title: `Copied ${copied.length} assignments from ${fromDateStr}` });
    } catch {
      toast({ title: 'Failed to copy trips', variant: 'destructive' });
    }
  };

  const handleSaveTrips = async () => {
    try {
      const assignments = workers.map(w => ({
        trip_date: toDateStr(selectedDate),
        worker_name: w.name,
        site: w.site,
        department: w.department,
        time_slot: w.timeSlot,
        start_time: w.startTime || null,
        end_time: w.endTime || null,
        urgent: w.urgent || false,
        project_id: null,
        project_name: '',
        vehicle_type: null,
        vehicle_number: null,
      }));
      await saveTripAssignments(toDateStr(selectedDate), assignments);
      setSaved(true);
      getRecentTripDates().then(setRecentDates).catch(() => {});
      toast({ title: `Saved ${workers.length} assignments for ${format(selectedDate, 'MMM d, yyyy')}` });
    } catch {
      toast({ title: 'Failed to save trips', variant: 'destructive' });
    }
  };

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
      if (workers.some(tw => tw.name === w.name && tw.site === selectedProjectData.site && tw.timeSlot === assignTimeSlot)) return;
      newAssignments.push({
        id: `TW-${Date.now()}-${wId}`,
        name: w.name,
        site: selectedProjectData.site,
        department: w.department,
        timeSlot: assignTimeSlot,
        startTime: assignStartTime,
        endTime: assignEndTime,
        urgent: assignUrgent,
      });
    });
    setWorkers(prev => [...prev, ...newAssignments]);
    setSelectedWorkers(new Set());
    setAssignUrgent(false);
    setSaved(false);
    toast({ title: `${newAssignments.length} workers assigned to ${selectedProjectData.name}` });
  };

  const handleRemoveWorker = (id: string) => { setWorkers(prev => prev.filter(w => w.id !== id)); setSaved(false); };

  const handleOptimize = () => {
    if (workers.length === 0) { toast({ title: 'No workers assigned yet', variant: 'destructive' }); return; }
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
          imported.push({ id: `TW-IMP-${i}-${idx}`, name, site: endLocation, department: row[4] ? String(row[4]).trim() : 'General', timeSlot: snapToTimeSlot(startTime) });
        });
      }
      const unique = new Map<string, TripWorker>();
      imported.forEach(w => { const key = `${w.name.toUpperCase()}-${getAreaCluster(w.site)}-${w.timeSlot}`; if (!unique.has(key)) unique.set(key, w); });
      setWorkers(Array.from(unique.values()));
      setSaved(false);
      toast({ title: `Imported ${unique.size} worker assignments` });
    } catch { toast({ title: 'Failed to parse Excel file', variant: 'destructive' }); }
  };

  const filteredGroups = activeSlot === 'All' ? tripGroups : tripGroups.filter(g => g.timeSlot === activeSlot);

  const workersBySlot = useMemo(() => {
    const map: Record<string, number> = {};
    TIME_SLOTS.forEach(s => { map[s] = workers.filter(w => w.timeSlot === s).length; });
    return map;
  }, [workers]);

  const workersBySite = useMemo(() => {
    const map: Record<string, TripWorker[]> = {};
    workers.forEach(w => { const area = getAreaCluster(w.site); if (!map[area]) map[area] = []; map[area].push(w); });
    return map;
  }, [workers]);

  const visibleSteps = STEPS.filter(s => role === 'admin' ? true : !s.adminOnly);

  // Previous dates for copy
  const copyableDates = recentDates.filter(d => d !== toDateStr(selectedDate));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Trip Planning</h1>
          <p className="text-muted-foreground text-sm">{workers.length} workers assigned • {tripGroups.length} trips planned</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button onClick={() => { setRole('engineer'); setStep('assign'); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${role === 'engineer' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              <UserCog className="h-4 w-4" /> Engineer
            </button>
            <button onClick={() => { setRole('admin'); setStep('assign'); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-input ${role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              <ShieldCheck className="h-4 w-4" /> Admin
            </button>
          </div>
        </div>
      </div>

      {/* Date Picker Bar */}
      <div className="kpi-card flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Trip Date:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">←</button>
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
                onSelect={handleDateChange}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">→</button>
          <button onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90">Today</button>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {loadingTrips && <span className="text-xs text-muted-foreground">Loading...</span>}
          {!loadingTrips && saved && <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
          <button onClick={handleSaveTrips} disabled={workers.length === 0}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
            <Save className="h-3 w-3" /> Save
          </button>
          {copyableDates.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copy From...
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <p className="text-xs font-medium text-muted-foreground mb-2">Copy trips from a previous date:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {copyableDates.slice(0, 10).map(d => (
                    <button key={d} onClick={() => handleCopyFromDate(d)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
                      {format(new Date(d + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {visibleSteps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <button onClick={() => setStep(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${step === s.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              <span className={`h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold ${step === s.key ? 'bg-primary-foreground text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{i + 1}</span>
              {s.label}
            </button>
            {i < visibleSteps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {step === 'assign' && (
        <div className="space-y-4">
          <div className="kpi-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><FolderKanban className="h-4 w-4 text-accent" /> Select Project & Assign Workers</h2>
              <ExcelUploadButton label="Import from Excel" onFileSelect={handleExcelImport} />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">Trip Time</label>
                <select value={assignTimeSlot} onChange={e => setAssignTimeSlot(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <input type="checkbox" id="urgent-assign" checked={assignUrgent} onChange={e => setAssignUrgent(e.target.checked)} className="rounded border-input" />
                <label htmlFor="urgent-assign" className="text-sm text-muted-foreground">Mark as Urgent</label>
              </div>
              <div className="flex items-end">
                <button onClick={handleAssignWorkers} disabled={!selectedProject || selectedWorkers.size === 0}
                  className="w-full px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Assign ({selectedWorkers.size})
                </button>
              </div>
            </div>
            {selectedProjectData && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md">
                <MapPin className="h-4 w-4 text-accent" />
                <span className="font-medium">{selectedProjectData.name}</span>
                <span className="text-muted-foreground">→ {selectedProjectData.site}</span>
                <span className="text-xs text-muted-foreground ml-auto">{selectedProjectData.workersAssigned}/{selectedProjectData.workersRequired} workers needed</span>
              </div>
            )}
            {selectedProject && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select workers to assign (click to toggle):</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {workerList.map(w => {
                    const isSelected = selectedWorkers.has(w.id);
                    const isAlreadyAssigned = workers.some(tw => tw.name === w.name);
                    return (
                      <button key={w.id} disabled={isAlreadyAssigned}
                        onClick={() => { setSelectedWorkers(prev => { const next = new Set(prev); if (next.has(w.id)) next.delete(w.id); else next.add(w.id); return next; }); }}
                        className={`text-left p-2 rounded-md border text-sm transition-colors ${isAlreadyAssigned ? 'border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed' : isSelected ? 'border-accent bg-accent/10 text-foreground' : 'border-input bg-background hover:bg-muted/50'}`}>
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

          {workers.length > 0 && (
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Assignments for {format(selectedDate, 'MMM d')} ({workers.length})</h2>
                <button onClick={() => setStep('review')} className="text-sm text-accent hover:underline flex items-center gap-1">Review All <ArrowRight className="h-3 w-3" /></button>
              </div>
              <div className="space-y-3">
                {Object.entries(workersBySite).map(([area, ws]) => (
                  <div key={area} className="bg-muted/30 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-1.5"><MapPin className="h-3 w-3 text-accent" /> {area}</span>
                      <span className="text-xs text-muted-foreground">{ws.length} workers</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ws.map(w => (
                        <span key={w.id} className="inline-flex items-center gap-1 text-xs bg-background px-2 py-1 rounded border border-border">
                          {w.name} <span className="text-muted-foreground">{w.timeSlot}</span>
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

      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['All', ...TIME_SLOTS].map(slot => (
              <button key={slot} onClick={() => setActiveSlot(slot)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeSlot === slot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                <Clock className="h-3 w-3" /> {slot}
                {slot !== 'All' && <span className="bg-background/20 text-xs px-1.5 py-0.5 rounded">{workersBySlot[slot] || 0}</span>}
              </button>
            ))}
          </div>
          <div className="kpi-card overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">All Assignments — {format(selectedDate, 'MMM d, yyyy')}</h2>
              <div className="flex gap-2">
                <button onClick={() => setStep('assign')} className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add More
                </button>
                {role === 'admin' && (
                  <button onClick={handleOptimize} className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Optimize Trips
                  </button>
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Worker</th>
                  <th className="pb-3 font-medium">Site</th>
                  <th className="pb-3 font-medium">Dept</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Flags</th>
                  <th className="pb-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(activeSlot === 'All' ? workers : workers.filter(w => w.timeSlot === activeSlot)).map(w => (
                  <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-medium">{w.name}</td>
                    <td className="py-2.5 text-muted-foreground">{w.site}</td>
                    <td className="py-2.5 text-muted-foreground">{w.department}</td>
                    <td className="py-2.5"><span className="bg-secondary px-2 py-0.5 rounded text-xs">{w.timeSlot}</span></td>
                    <td className="py-2.5">{w.urgent && <span className="inline-flex items-center gap-1 text-xs text-warning"><Shield className="h-3 w-3" />Urgent</span>}</td>
                    <td className="py-2.5"><button onClick={() => handleRemoveWorker(w.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'optimize' && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="kpi-card"><p className="text-sm text-muted-foreground">Total Trips</p><p className="text-3xl font-bold">{stats.totalTrips}</p></div>
              <div className="kpi-card"><p className="text-sm text-muted-foreground">Trips Saved</p><p className="text-3xl font-bold text-success">{stats.tripsSaved}</p></div>
              <div className="kpi-card"><p className="text-sm text-muted-foreground">Avg Utilization</p><p className="text-3xl font-bold">{stats.avgUtilization}%</p></div>
              <div className="kpi-card"><p className="text-sm text-muted-foreground">Workers Grouped</p><p className="text-3xl font-bold">{workers.length}</p></div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {['All', ...TIME_SLOTS].map(slot => (
              <button key={slot} onClick={() => setActiveSlot(slot)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeSlot === slot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                {slot}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGroups.map(g => (
              <div key={g.id} className={`kpi-card ${g.isInefficient ? 'border-warning/40' : ''} ${g.status === 'dispatched' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-1.5"><Bus className="h-4 w-4 text-accent" /> {g.area}</h3>
                    <p className="text-xs text-muted-foreground">{g.timeSlot} • {g.workers.length} workers</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {g.isUrgent && <AlertTriangle className="h-4 w-4 text-warning" />}
                    {g.status === 'dispatched' && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {g.workers.map(w => <span key={w.id} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{w.name}</span>)}
                  </div>
                  {g.suggestedVehicle && (
                    <div className="flex items-center justify-between bg-muted/30 px-2 py-1.5 rounded text-xs">
                      <span>{g.suggestedVehicle.type} (cap: {g.suggestedVehicle.capacity})</span>
                      <div className="flex items-center gap-2">
                        <Progress value={g.utilization * 100} className="h-1.5 w-12" />
                        <span>{Math.round(g.utilization * 100)}%</span>
                      </div>
                    </div>
                  )}
                  {g.isInefficient && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low utilization — consider merging</p>}
                  {role === 'admin' && g.status !== 'dispatched' && (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <button onClick={() => handleOverrideVehicle(g.id)} className="flex-1 px-2 py-1.5 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1">
                        <Edit3 className="h-3 w-3" /> Override
                      </button>
                      <button onClick={() => handleDispatch(g.id)} className="flex-1 px-2 py-1.5 rounded bg-accent text-accent-foreground text-xs hover:bg-accent/90 transition-colors flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Dispatch
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {role === 'admin' && tripGroups.some(g => g.status !== 'dispatched') && (
            <div className="flex justify-end">
              <button onClick={handleDispatchAll} className="px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Dispatch All Trips
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'dispatch' && (
        <div className="kpi-card text-center py-12">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">All Trips Dispatched!</h2>
          <p className="text-muted-foreground mb-4">{tripGroups.length} trips dispatched for {format(selectedDate, 'MMM d, yyyy')}.</p>
          {stats && (
            <div className="flex justify-center gap-6 text-sm">
              <div><span className="text-muted-foreground">Trips saved:</span> <strong className="text-success">{stats.tripsSaved}</strong></div>
              <div><span className="text-muted-foreground">Avg utilization:</span> <strong>{stats.avgUtilization}%</strong></div>
              <div><span className="text-muted-foreground">Workers grouped:</span> <strong>{workers.length}</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
