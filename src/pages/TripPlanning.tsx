import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TripGroup, TripWorker, TripStats,
  optimizeTrips, TIME_SLOTS, MIN_UTILIZATION,
  snapToTimeSlot, getAreaCluster,
} from '@/lib/tripPlanning';
import {
  fetchProjects, fetchWorkers, fetchVehicles, fetchTripsByDate, saveTripAssignments, getRecentTripDates,
  fetchDriverAreaDefaults, upsertDriverAreaDefaults,
} from '@/lib/supabaseData';
import { fetchTripRequestsByDate, type DailyTripRequest } from '@/lib/tripRequestsData';
import type { DriverAreaDefault } from '@/lib/supabaseData';
import type { Project, Worker, Vehicle } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import {
  Bus, Users, MapPin, Clock, Zap, AlertTriangle, CheckCircle2,
  BarChart3, TrendingUp, Merge, Shield, UserCog, ShieldCheck,
  Plus, Trash2, Edit3, FolderKanban, ArrowRight, CalendarIcon, Copy, Save,
  RefreshCw, Settings2, Inbox,
} from 'lucide-react';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format, subDays, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';

type PlanningStep = 'requests' | 'review' | 'optimize' | 'dispatch';

const STEPS: { key: PlanningStep; label: string }[] = [
  { key: 'requests', label: 'Engineer Requests' },
  { key: 'review', label: 'Review Assignments' },
  { key: 'optimize', label: 'Optimize Trips' },
  { key: 'dispatch', label: 'Dispatch' },
];

const AREA_LIST = [
  'Al Quoz', 'DIP', 'Jebel Ali', 'Bur Dubai', 'Deira', 'DAFZA',
  'Al Quasis', 'Khawaneej', 'International City', 'Silicon Oasis', 'Other',
];

function toDateStr(d: Date) { return format(d, 'yyyy-MM-dd'); }

export default function TripPlanning() {
  const [step, setStep] = useState<PlanningStep>('requests');
  const [tripRequests, setTripRequests] = useState<DailyTripRequest[]>([]);
  const [workers, setWorkers] = useState<TripWorker[]>([]);
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [activeSlot, setActiveSlot] = useState<string>('All');

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [workerList, setWorkerList] = useState<Worker[]>([]);
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);

  // Date-based scheduling
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [recentDates, setRecentDates] = useState<string[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Default time slot for auto-generation
  const [defaultTimeSlot, setDefaultTimeSlot] = useState(TIME_SLOTS[0]);

  // Project selection for trip generation
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Driver-area defaults
  const [driverAreaDefaults, setDriverAreaDefaults] = useState<DriverAreaDefault[]>([]);
  const [showDriverSettings, setShowDriverSettings] = useState(false);
  const [editingDriver, setEditingDriver] = useState('');
  const [editingAreas, setEditingAreas] = useState<string[]>([]);

  useEffect(() => {
    fetchProjects().then(setProjectList).catch(() => {});
    fetchWorkers().then(setWorkerList).catch(() => {});
    fetchVehicles().then(setVehicleList).catch(() => {});
    getRecentTripDates().then(setRecentDates).catch(() => {});
    fetchDriverAreaDefaults().then(setDriverAreaDefaults).catch(() => {});
  }, []);

  // Initialize selected projects when project list loads
  useEffect(() => {
    const active = projectList.filter(p => (p.status === 'Active' || p.status === 'Scheduled') && (p.workerNames || []).length > 0);
    setSelectedProjectIds(new Set(active.map(p => p.id)));
  }, [projectList]);

  // Load trips when date changes
  const loadTripsForDate = useCallback(async (date: Date) => {
    setLoadingTrips(true);
    try {
      const rows = await fetchTripsByDate(toDateStr(date));
      if (rows.length > 0) {
        const loaded: TripWorker[] = rows.map((r) => ({
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
        setSaved(true);
        setGenerated(true);
      } else {
        setWorkers([]);
        setSaved(false);
        setGenerated(false);
      }
      setTripGroups([]);
      setStats(null);
      setStep('review');
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

  const toggleProjectSelection = (id: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllProjects = () => {
    const active = projectList.filter(p => (p.status === 'Active' || p.status === 'Scheduled') && (p.workerNames || []).length > 0);
    setSelectedProjectIds(new Set(active.map(p => p.id)));
  };

  const deselectAllProjects = () => setSelectedProjectIds(new Set());

  // Auto-generate trips from SELECTED projects only
  const handleAutoGenerate = () => {
    const selectedProjects = projectList.filter(p => selectedProjectIds.has(p.id));
    if (selectedProjects.length === 0) {
      toast({ title: 'No projects selected. Pick projects to include.', variant: 'destructive' });
      return;
    }

    const gen: TripWorker[] = [];
    const seen = new Set<string>();

    selectedProjects.forEach(project => {
      const workerNames = project.workerNames || [];
      workerNames.forEach((name, idx) => {
        if (!name.trim()) return;
        const key = `${name.trim().toUpperCase()}-${project.site}`;
        if (seen.has(key)) return;
        seen.add(key);

        const masterWorker = workerList.find(w => w.name.toLowerCase() === name.trim().toLowerCase());

        gen.push({
          id: `TW-AUTO-${project.id}-${idx}`,
          name: name.trim(),
          site: project.site || 'Unassigned',
          department: masterWorker?.department || project.type || 'General',
          timeSlot: defaultTimeSlot,
          startTime: '',
          endTime: '',
          urgent: project.priority === 'High',
        });
      });
    });

    if (gen.length === 0) {
      toast({ title: 'No workers found in selected projects.', variant: 'destructive' });
      return;
    }

    setWorkers(gen);
    setGenerated(true);
    setSaved(false);
    setShowProjectSelector(false);
    toast({ title: `Generated ${gen.length} trips from ${selectedProjects.length} projects` });
  };

  // Driver-area helpers
  const driversByArea = useMemo(() => {
    const map: Record<string, string[]> = {};
    driverAreaDefaults.forEach(d => {
      if (!map[d.area]) map[d.area] = [];
      map[d.area].push(d.driver_name);
    });
    return map;
  }, [driverAreaDefaults]);

  const getDefaultDriverForArea = (area: string): string => {
    return driversByArea[area]?.[0] || '';
  };

  const allDrivers = useMemo(() => {
    const fromVehicles = vehicleList.filter(v => v.driver).map(v => v.driver);
    const fromDefaults = driverAreaDefaults.map(d => d.driver_name);
    return [...new Set([...fromVehicles, ...fromDefaults])].sort();
  }, [vehicleList, driverAreaDefaults]);

  const handleSaveDriverArea = async () => {
    if (!editingDriver) return;
    try {
      await upsertDriverAreaDefaults(editingDriver, editingAreas);
      const updated = await fetchDriverAreaDefaults();
      setDriverAreaDefaults(updated);
      setEditingDriver('');
      setEditingAreas([]);
      toast({ title: `Driver area assignments saved` });
    } catch {
      toast({ title: 'Failed to save driver area', variant: 'destructive' });
    }
  };

  const startEditDriver = (driver: string) => {
    setEditingDriver(driver);
    setEditingAreas(driverAreaDefaults.filter(d => d.driver_name === driver).map(d => d.area));
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
        startTime: r.start_time || '',
        endTime: r.end_time || '',
        urgent: r.urgent,
      }));
      setWorkers(copied);
      setSaved(false);
      setGenerated(true);
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

  const handleRemoveWorker = (id: string) => { setWorkers(prev => prev.filter(w => w.id !== id)); setSaved(false); };

  const handleUpdateWorker = (id: string, field: keyof TripWorker, value: string | boolean) => {
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    setSaved(false);
  };

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

  const handleOverrideDriver = (groupId: string, driver: string) => {
    setTripGroups(prev => prev.map(g => {
      if (g.id !== groupId || !g.suggestedVehicle) return g;
      return { ...g, suggestedVehicle: { ...g.suggestedVehicle, driver } };
    }));
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
      setGenerated(true);
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

  const visibleSteps = STEPS;

  // Load engineer requests for selected date
  const loadRequests = useCallback(async () => {
    try {
      const reqs = await fetchTripRequestsByDate(toDateStr(selectedDate));
      setTripRequests(reqs);
    } catch { /* ignore */ }
  }, [selectedDate]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Generate workers from engineer requests
  const handleGenerateFromRequests = () => {
    if (tripRequests.length === 0) {
      toast({ title: 'No engineer submissions for this date', variant: 'destructive' });
      return;
    }
    const gen: TripWorker[] = [];
    const seen = new Set<string>();
    tripRequests.filter(r => r.status === 'pending' || r.status === 'approved').forEach(req => {
      (req.worker_names || []).forEach((name, idx) => {
        if (!name.trim()) return;
        const key = `${name.trim().toUpperCase()}-${req.site}`;
        if (seen.has(key)) return;
        seen.add(key);
        const masterWorker = workerList.find(w => w.name.toLowerCase() === name.trim().toLowerCase());
        gen.push({
          id: `TW-REQ-${req.id}-${idx}`,
          name: name.trim(),
          site: req.site || 'Unassigned',
          department: masterWorker?.department || req.work_type || 'General',
          timeSlot: defaultTimeSlot,
          startTime: '',
          endTime: '',
          urgent: req.priority === 'High',
        });
      });
    });
    if (gen.length === 0) {
      toast({ title: 'No workers found in submissions', variant: 'destructive' });
      return;
    }
    setWorkers(gen);
    setGenerated(true);
    setSaved(false);
    setStep('review');
    toast({ title: `Generated ${gen.length} trips from ${tripRequests.length} engineer submissions` });
  };

  const copyableDates = recentDates.filter(d => d !== toDateStr(selectedDate));

  const activeProjectsWithWorkers = projectList.filter(p => (p.status === 'Active' || p.status === 'Scheduled') && (p.workerNames || []).length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Trip Planning</h1>
          <p className="text-muted-foreground text-sm">{workers.length} workers assigned • {tripGroups.length} trips planned</p>
        </div>
        <div className="flex items-center gap-2">
          {(
            <Dialog open={showDriverSettings} onOpenChange={setShowDriverSettings}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  <Settings2 className="h-4 w-4" /> Driver Areas
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Driver–Area Default Assignments</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mb-4">
                  Assign default areas to drivers. When trips are optimized, drivers will be auto-suggested based on area. You can override per trip.
                </p>
                {/* Existing assignments */}
                <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                  {allDrivers.length === 0 && <p className="text-sm text-muted-foreground">No drivers found. Add vehicles with drivers first.</p>}
                  {allDrivers.map(driver => {
                    const areas = driverAreaDefaults.filter(d => d.driver_name === driver).map(d => d.area);
                    return (
                      <div key={driver} className="flex items-center justify-between bg-muted/30 px-3 py-2 rounded-md">
                        <div>
                          <span className="text-sm font-medium">{driver}</span>
                          {areas.length > 0 ? (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {areas.map(a => <span key={a} className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded">{a}</span>)}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No area assigned</p>
                          )}
                        </div>
                        <button onClick={() => startEditDriver(driver)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Edit form */}
                {editingDriver && (
                  <div className="border border-border rounded-md p-3 space-y-3">
                    <p className="text-sm font-medium">Editing: <strong>{editingDriver}</strong></p>
                    <div className="flex flex-wrap gap-2">
                      {AREA_LIST.map(area => (
                        <label key={area} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={editingAreas.includes(area)}
                            onChange={e => {
                              if (e.target.checked) setEditingAreas(prev => [...prev, area]);
                              else setEditingAreas(prev => prev.filter(a => a !== area));
                            }}
                            className="rounded border-input" />
                          <span className="text-xs">{area}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveDriverArea} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                        Save
                      </button>
                      <button onClick={() => { setEditingDriver(''); setEditingAreas([]); }} className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
           )}
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
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus className={cn("p-3 pointer-events-auto")} />
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

      {/* Steps */}
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

      {/* Step: Engineer Requests */}
      {step === 'requests' && (
        <div className="space-y-4">
          <div className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Inbox className="h-5 w-5 text-accent" /> Engineer Submissions for {format(selectedDate, 'MMM d, yyyy')}
              </h2>
              <button onClick={loadRequests} className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
            {tripRequests.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold">No Submissions Yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Engineers haven't submitted trip requests for this date yet.</p>
                <p className="text-xs text-muted-foreground mt-2">You can also generate trips directly from projects using the Review step.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {tripRequests.map(req => (
                    <div key={req.id} className={`p-4 rounded-md border transition-colors ${req.status === 'pending' ? 'border-accent/40 bg-accent/5' : 'border-border'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{req.project_name}</span>
                            {req.priority === 'High' && <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">High</span>}
                            <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{req.work_type || 'General'}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${req.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                              {req.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.site}</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {(req.worker_names || []).length} workers</span>
                            <span className="flex items-center gap-1"><UserCog className="h-3 w-3" /> {req.engineer_name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(req.worker_names || []).map((n, i) => (
                              <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{n}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground">
                    {tripRequests.length} submissions • {tripRequests.reduce((s, r) => s + (r.worker_names || []).length, 0)} total workers
                  </p>
                  <div className="flex gap-2 items-center">
                    <div>
                      <select value={defaultTimeSlot} onChange={e => setDefaultTimeSlot(e.target.value)}
                        className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <button onClick={handleGenerateFromRequests}
                      className="px-5 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Generate Trips from Submissions
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          {/* Auto-generate panel with project selection */}
          {!generated && workers.length === 0 && !showProjectSelector && (
            <div className="kpi-card text-center py-8 space-y-4">
              <FolderKanban className="h-12 w-12 text-accent mx-auto" />
              <div>
                <h2 className="text-lg font-semibold">Generate Trips from Projects</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select which projects to include for {format(selectedDate, 'MMM d, yyyy')}.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Default Time Slot</label>
                  <select value={defaultTimeSlot} onChange={e => setDefaultTimeSlot(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="pt-4">
                  <button onClick={() => setShowProjectSelector(true)}
                    className="px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Select Projects & Generate
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <ExcelUploadButton label="Or Import from Excel" onFileSelect={handleExcelImport} />
              </div>
            </div>
          )}

          {/* Project selector */}
          {showProjectSelector && !generated && (
            <div className="kpi-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Select Projects for {format(selectedDate, 'MMM d, yyyy')}</h2>
                <div className="flex gap-2">
                  <button onClick={selectAllProjects} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">Select All</button>
                  <button onClick={deselectAllProjects} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">Deselect All</button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Uncheck projects that don't need trips on this date.</p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activeProjectsWithWorkers.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active projects with workers found.</p>
                )}
                {activeProjectsWithWorkers.map(p => (
                  <label key={p.id} className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${selectedProjectIds.has(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
                    <input type="checkbox" checked={selectedProjectIds.has(p.id)} onChange={() => toggleProjectSelection(p.id)}
                      className="rounded border-input mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{p.code}</span>
                        {p.priority === 'High' && <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">High Priority</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.site || 'No site'}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {(p.workerNames || []).length} workers</span>
                        <span>{p.status}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">{selectedProjectIds.size} of {activeProjectsWithWorkers.length} projects selected</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowProjectSelector(false)} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80">Cancel</button>
                  <button onClick={handleAutoGenerate} disabled={selectedProjectIds.size === 0}
                    className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Generate {selectedProjectIds.size > 0 ? `(${selectedProjectIds.size} projects)` : ''}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review table */}
          {(generated || workers.length > 0) && (
            <>
              <div className="flex gap-2 flex-wrap">
                {['All', ...TIME_SLOTS].map(slot => (
                  <button key={slot} onClick={() => setActiveSlot(slot)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeSlot === slot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                    <Clock className="h-3 w-3" /> {slot}
                    {slot !== 'All' && <span className="bg-background/20 text-xs px-1.5 py-0.5 rounded">{workersBySlot[slot] || 0}</span>}
                  </button>
                ))}
              </div>

              {/* Summary by site */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(workersBySite).map(([area, ws]) => (
                  <div key={area} className="kpi-card py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="h-3 w-3 text-accent" />
                      <span className="text-xs font-medium truncate">{area}</span>
                    </div>
                    <p className="text-xl font-bold">{ws.length}</p>
                    <p className="text-[10px] text-muted-foreground">workers</p>
                  </div>
                ))}
              </div>

              <div className="kpi-card overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Assignments — {format(selectedDate, 'MMM d, yyyy')} ({workers.length})</h2>
                  <div className="flex gap-2">
                    <button onClick={() => { setGenerated(false); setShowProjectSelector(true); }}
                      className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Re-select Projects
                    </button>
                    <ExcelUploadButton label="Import Excel" onFileSelect={handleExcelImport} />
                    <button onClick={handleOptimize} className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Optimize Trips
                    </button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Worker</th>
                      <th className="pb-3 font-medium">Site</th>
                      <th className="pb-3 font-medium">Dept</th>
                      <th className="pb-3 font-medium">Slot</th>
                      <th className="pb-3 font-medium">Start</th>
                      <th className="pb-3 font-medium">End</th>
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
                        <td className="py-2.5">
                          <select value={w.timeSlot} onChange={e => handleUpdateWorker(w.id, 'timeSlot', e.target.value)}
                            className="px-2 py-0.5 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-2.5">
                          <input type="time" value={w.startTime || ''} onChange={e => handleUpdateWorker(w.id, 'startTime', e.target.value)}
                            className="px-1 py-0.5 rounded border border-input bg-background text-xs w-24 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="py-2.5">
                          <input type="time" value={w.endTime || ''} onChange={e => handleUpdateWorker(w.id, 'endTime', e.target.value)}
                            className="px-1 py-0.5 rounded border border-input bg-background text-xs w-24 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="py-2.5">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={w.urgent || false} onChange={e => handleUpdateWorker(w.id, 'urgent', e.target.checked)}
                              className="rounded border-input" />
                            <span className="text-xs text-muted-foreground">Urgent</span>
                          </label>
                        </td>
                        <td className="py-2.5"><button onClick={() => handleRemoveWorker(w.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {workers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No assignments yet. Generate from projects or import an Excel file.</p>
                )}
              </div>
            </>
          )}
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
            {filteredGroups.map(g => {
              const defaultDriver = getDefaultDriverForArea(g.area);
              const currentDriver = g.suggestedVehicle?.driver || defaultDriver;
              return (
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
                    {/* Driver assignment */}
                    <div className="flex items-center gap-2 bg-muted/20 px-2 py-1.5 rounded text-xs">
                      <UserCog className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Driver:</span>
                      {g.status !== 'dispatched' ? (
                        <select value={currentDriver}
                          onChange={e => handleOverrideDriver(g.id, e.target.value)}
                          className="flex-1 px-1.5 py-0.5 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                          <option value="">— Select —</option>
                          {allDrivers.map(d => (
                            <option key={d} value={d}>{d} {driversByArea[g.area]?.includes(d) ? '(default)' : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium">{currentDriver || 'Unassigned'}</span>
                      )}
                    </div>
                    {g.isInefficient && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low utilization — consider merging</p>}
                    {g.status !== 'dispatched' && (
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button onClick={() => handleOverrideVehicle(g.id)} className="flex-1 px-2 py-1.5 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1">
                          <Edit3 className="h-3 w-3" /> Override Vehicle
                        </button>
                        <button onClick={() => handleDispatch(g.id)} className="flex-1 px-2 py-1.5 rounded bg-accent text-accent-foreground text-xs hover:bg-accent/90 transition-colors flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Dispatch
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {tripGroups.some(g => g.status !== 'dispatched') && (
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
