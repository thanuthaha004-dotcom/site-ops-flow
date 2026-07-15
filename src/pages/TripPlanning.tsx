import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TripGroup, TripWorker, TripStats,
  optimizeTrips, TIME_SLOTS, MIN_UTILIZATION,
  snapToTimeSlot, getAreaCluster, setCachedVehicles,
} from '@/lib/tripPlanning';
import {
  fetchProjects, fetchWorkers, fetchVehicles, fetchTripsByDate, saveTripAssignments, saveDispatchedTripAssignments, getRecentTripDates,
  fetchDriverAreaDefaults, upsertDriverAreaDefaults,
} from '@/lib/supabaseData';
import { fetchTripRequestsByDate, fetchRequestLiveStatuses, fetchCompletedWorkerKeys, buildCompletedWorkerKey, type DailyTripRequest, type RequestLiveStatus } from '@/lib/tripRequestsData';
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
  const [requestLiveStatus, setRequestLiveStatus] = useState<Map<string, RequestLiveStatus>>(new Map());
  const [completedWorkerKeys, setCompletedWorkerKeys] = useState<Set<string>>(new Set());
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
    fetchVehicles().then((vehicles) => {
      setVehicleList(vehicles);
      setCachedVehicles(vehicles);
    }).catch(() => {});
    getRecentTripDates().then(setRecentDates).catch(() => {});
    fetchDriverAreaDefaults().then(setDriverAreaDefaults).catch(() => {});
    import('@/lib/zoneMappings').then(m => m.loadZoneMappings().catch(() => {}));
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
      const dateStr = toDateStr(date);
      const [rows, completed] = await Promise.all([
        fetchTripsByDate(dateStr),
        fetchCompletedWorkerKeys(dateStr).catch(() => new Set<string>()),
      ]);
      setCompletedWorkerKeys(completed);
      if (rows.length > 0) {
        const vehicleByNumber = new Map(vehicleList.map(v => [v.number, v]));
        const loaded: TripWorker[] = rows.flatMap((r) => {
          // A persisted row may already group multiple workers (CSV in worker_name).
          // Split back so the planner can re-edit per worker.
          const rawNames = (r.worker_name || '').split(',').map(s => s.trim()).filter(Boolean);
          const isPlaceholder = rawNames.length === 0 || (rawNames.length === 1 && rawNames[0] === '— No personnel —');
          const names = isPlaceholder ? ['— No personnel —'] : rawNames;
          return names.map((name, idx) => ({
            id: `TW-DB-${r.id}-${idx}`,
            name,
            site: r.site,
            department: r.department,
            timeSlot: r.time_slot,
            startTime: r.start_time || '',
            endTime: r.end_time || '',
            urgent: r.urgent,
            projectId: r.project_id,
            projectName: r.project_name,
            engineerName: r.engineer_name || '',
            pickupLocation: r.pickup_location || 'Al Quoz Labour Camp',
            notes: (r as any).notes || '',
            noPersonnel: isPlaceholder,
            requestedVehicleNumber: r.vehicle_number || null,
            requestedDriver: (r as any).driver_name || null,
            executionOrder: (r as any).execution_order ?? null,
          }));
        });
        const groupMap = new Map<string, TripGroup>();
        rows.forEach((r) => {
          const rawNames = (r.worker_name || '').split(',').map(s => s.trim()).filter(Boolean);
          const isPlaceholder = rawNames.length === 0 || (rawNames.length === 1 && rawNames[0] === '— No personnel —');
          const names = isPlaceholder ? ['— No personnel —'] : rawNames;
          const vehicle = r.vehicle_number ? vehicleByNumber.get(r.vehicle_number) : undefined;
          const key = [r.trip_date, r.time_slot, r.vehicle_number || '', r.pickup_location || '', r.status].join('||');
          const existing = groupMap.get(key);
          const rowWorkers: TripWorker[] = names.map((name, idx) => ({
            id: `TW-DB-${r.id}-${idx}`,
            name,
            site: r.site,
            department: r.department,
            timeSlot: r.time_slot,
            startTime: r.start_time || '',
            endTime: r.end_time || '',
            urgent: r.urgent,
            projectId: r.project_id,
            projectName: r.project_name,
            engineerName: r.engineer_name || '',
            pickupLocation: r.pickup_location || 'Al Quoz Labour Camp',
            notes: r.notes || '',
            noPersonnel: isPlaceholder,
            requestedVehicleNumber: r.vehicle_number || null,
            executionOrder: (r as any).execution_order ?? null,
          }));
          if (existing) {
            existing.workers.push(...rowWorkers);
            existing.sites = [...new Set([...existing.sites, r.site])];
            existing.area = [...new Set([...existing.sites.map(getAreaCluster)])].join(' + ');
            existing.isUrgent = existing.isUrgent || !!r.urgent;
            existing.liveTripId = existing.liveTripId || r.id;
            existing.startedAt = existing.startedAt || r.started_at || null;
            existing.completedAt = existing.completedAt || r.completed_at || null;
            const capacity = existing.suggestedVehicle?.capacity || Math.max(existing.workers.length, 1);
            existing.utilization = existing.workers.length / capacity;
            existing.isInefficient = existing.utilization < MIN_UTILIZATION && !existing.isUrgent;
          } else {
            const capacity = vehicle?.capacity || Math.max(names.length, 1);
            groupMap.set(key, {
              id: `TRP-DB-${r.id}`,
              area: getAreaCluster(r.site),
              sites: [r.site],
              workers: rowWorkers,
              timeSlot: r.time_slot,
              suggestedVehicle: r.vehicle_number ? {
                id: vehicle?.id || `db-${r.vehicle_number}`,
                number: r.vehicle_number,
                type: r.vehicle_type || vehicle?.type || 'Vehicle',
                capacity,
                driver: vehicle?.driver || '',
              } : null,
              status: r.status === 'completed' ? 'completed' : r.status === 'in_progress' ? 'in_progress' : r.status === 'assigned' ? 'dispatched' : 'pending',
              utilization: names.length / capacity,
              isInefficient: names.length / capacity < MIN_UTILIZATION && !r.urgent,
              isUrgent: !!r.urgent,
              startedAt: r.started_at || null,
              completedAt: r.completed_at || null,
              liveTripId: r.id,
            });
          }
        });
        setWorkers(loaded);
        const loadedGroups = Array.from(groupMap.values());
        setTripGroups(loadedGroups);
        setSaved(true);
        setGenerated(true);
        // If any trips are already dispatched/in-progress/completed for this date,
        // jump straight to the Dispatch view so the admin sees prior dispatch details.
        if (loadedGroups.some(g => g.status === 'dispatched' || g.status === 'in_progress' || g.status === 'completed')) {
          setStep('dispatch');
        }
      } else {
        setWorkers([]);
        setTripGroups([]);
        setSaved(false);
        setGenerated(false);
        setStep('requests');
      }
      setStats(null);
    } catch {
      toast({ title: 'Failed to load trips for this date', variant: 'destructive' });
    } finally {
      setLoadingTrips(false);
    }
  }, [vehicleList]);

  useEffect(() => { loadTripsForDate(selectedDate); }, [selectedDate, loadTripsForDate]);

  // ── Live status sync ──
  // Pull current status / started_at / completed_at from trip_schedules and
  // overlay it onto local tripGroups so the admin board shows real progress.
  const hydrateGroupsWithLiveStatus = useCallback(async () => {
    try {
      const dateStr = toDateStr(selectedDate);
      const [rows, completed] = await Promise.all([
        fetchTripsByDate(dateStr),
        fetchCompletedWorkerKeys(dateStr).catch(() => new Set<string>()),
      ]);
      setCompletedWorkerKeys(completed);
      if (rows.length === 0) return;
      setTripGroups(prev => {
        if (prev.length === 0) return prev;
        const norm = (s: string) => (s || '').trim().toUpperCase();
        const sitesNorm = (arr: string[]) => arr.map(norm);
        return prev.map(g => {
          const veh = g.suggestedVehicle?.number || null;
          const gSites = sitesNorm(g.sites);
          const gWorkerNames = new Set(g.workers.map(w => norm(w.name)));
          const match = rows.find(r => {
            if (r.time_slot !== g.timeSlot) return false;
            if (veh && r.vehicle_number && r.vehicle_number !== veh) return false;
            if (!gSites.includes(norm(r.site))) return false;
            const workerProjects = new Set(g.workers
              .filter(w => norm(w.site) === norm(r.site))
              .map(w => w.projectId || norm(w.projectName || '')));
            const rowProject = r.project_id || norm(r.project_name || '');
            if (workerProjects.size > 0 && !workerProjects.has(rowProject)) return false;
            const rNames = (r.worker_name || '').split(',').map(n => norm(n)).filter(Boolean);
            if (rNames.length === 0 || rNames.every(n => n.includes('NO PERSONNEL') || n.startsWith('—'))) {
              return g.workers.some(w => w.noPersonnel && norm(w.site) === norm(r.site));
            }
            return rNames.some(n => gWorkerNames.has(n));
          });
          if (!match) return g;
          let status: TripGroup['status'] = g.status;
          if (match.status === 'completed') status = 'completed';
          else if (match.status === 'in_progress') status = 'in_progress';
          else if (match.status === 'assigned') status = 'dispatched';
          return {
            ...g,
            status,
            startedAt: (match as any).started_at || null,
            completedAt: (match as any).completed_at || null,
            liveTripId: match.id,
          };
        });
      });
    } catch {/* silent */}
  }, [selectedDate]);

  useEffect(() => {
    hydrateGroupsWithLiveStatus();
    const t = setInterval(hydrateGroupsWithLiveStatus, 30000);
    return () => clearInterval(t);
  }, [hydrateGroupsWithLiveStatus, tripGroups.length]);

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
          projectId: project.id,
          projectName: project.name,
          engineerName: project.engineer || '',
          pickupLocation: 'Al Quoz Labour Camp',
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
        project_id: w.projectId || null,
        project_name: w.projectName || '',
        engineer_name: w.engineerName || '',
        pickup_location: w.pickupLocation || 'Al Quoz Labour Camp',
        notes: w.notes || '',
        vehicle_type: null,
        vehicle_number: null,
        execution_order: w.executionOrder ?? null,
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
    setCachedVehicles(vehicleList);
    // Only re-group workers whose trips aren't already completed.
    const pool = workers.filter(w => !completedWorkerKeys.has(keyForWorker(w)));
    if (pool.length === 0) { toast({ title: 'No pending workers to optimize', variant: 'destructive' }); return; }
    const result = optimizeTrips(pool);
    setTripGroups(result.groups);
    setStats(result.stats);
    setStep('optimize');
    toast({ title: `Optimized into ${result.groups.length} trips`, description: `${result.stats.tripsSaved} trips saved, ${result.stats.avgUtilization}% avg utilization` });
  };

  const persistDispatchedTrips = async (groups: TripGroup[]) => {
    // Group workers within each trip by (project, site, slot, vehicle, pickup) so
    // multiple passengers sharing pickup + drop-off + slot become ONE driver task.
    // Each saved row carries: passenger CSV, real project, engineer name, and pickup.
    type Bucket = {
      site: string;
      department: string;
      time_slot: string;
      project_id: string | null;
      project_name: string;
      engineer_name: string;
      pickup_location: string;
      vehicle_type: string | null;
      vehicle_number: string | null;
      start_time: string | null;
      end_time: string | null;
      urgent: boolean;
      names: string[];
      notes: string[];
      execution_order: number | null;
    };
    const buckets = new Map<string, Bucket>();

    groups.forEach(g => {
      const veh = g.suggestedVehicle;
      g.workers.forEach(w => {
        // Fall back to the trip's area only when the worker has no project at all.
        const projectName = w.projectName || g.area;
        const projectId = w.projectId || null;
        const engineerName = w.engineerName || '';
        const pickup = w.pickupLocation || 'Al Quoz Labour Camp';
        const key = [
          pickup, w.site, w.timeSlot, projectId || projectName,
          veh?.number || '', engineerName,
        ].join('||');

        const bucket = buckets.get(key);
        if (bucket) {
          // Skip placeholder names so a real passenger doesn't get prefixed by "— No personnel —"
          if (!w.noPersonnel && !bucket.names.includes(w.name)) bucket.names.push(w.name);
          if (w.urgent) bucket.urgent = true;
          if (w.notes && !bucket.notes.includes(w.notes)) bucket.notes.push(w.notes);
          // Bucket inherits the LOWEST Trip No — that trip runs first for the driver.
          if (w.executionOrder != null) {
            bucket.execution_order = bucket.execution_order == null
              ? w.executionOrder
              : Math.min(bucket.execution_order, w.executionOrder);
          }
        } else {
          buckets.set(key, {
            site: w.site,
            department: w.department,
            time_slot: w.timeSlot,
            project_id: projectId,
            project_name: projectName,
            engineer_name: engineerName,
            pickup_location: pickup,
            vehicle_type: veh?.type || null,
            vehicle_number: veh?.number || null,
            start_time: w.startTime || null,
            end_time: w.endTime || null,
            urgent: !!w.urgent,
            names: w.noPersonnel ? [] : [w.name],
            notes: w.notes ? [w.notes] : [],
            execution_order: w.executionOrder ?? null,
          });
        }
      });
    });

    const assignments = Array.from(buckets.values()).map(b => ({
      trip_date: toDateStr(selectedDate),
      worker_name: b.names.length > 0 ? b.names.join(', ') : '— No personnel —',
      site: b.site,
      department: b.department,
      time_slot: b.time_slot,
      start_time: b.start_time,
      end_time: b.end_time,
      urgent: b.urgent,
      project_id: b.project_id,
      project_name: b.project_name,
      engineer_name: b.engineer_name,
      pickup_location: b.pickup_location,
      notes: b.notes.join(' | '),
      vehicle_type: b.vehicle_type,
      vehicle_number: b.vehicle_number,
      execution_order: b.execution_order,
    }));

    await saveDispatchedTripAssignments(toDateStr(selectedDate), assignments);
    setSaved(true);
    getRecentTripDates().then(setRecentDates).catch(() => {});
  };

  const handleDispatch = async (groupId: string) => {
    const target = tripGroups.find(g => g.id === groupId);
    if (!target?.suggestedVehicle || !target.suggestedVehicle.number || target.suggestedVehicle.number === '—') {
      toast({ title: 'Select a vehicle first', description: 'Pick a vehicle from the dropdown before dispatching.', variant: 'destructive' });
      return;
    }
    const dispatchedTarget = { ...target, status: 'dispatched' as const };
    const updated = tripGroups.map(g => g.id === groupId ? dispatchedTarget : g);
    setTripGroups(updated);
    try {
      await persistDispatchedTrips([dispatchedTarget]);
      setStep('dispatch');
      toast({ title: 'Trip dispatched & saved!' });
    } catch {
      toast({ title: 'Dispatched locally but failed to save to database', variant: 'destructive' });
    }
  };

  const handleDispatchAll = async () => {
    const missing = tripGroups.filter(g => g.status !== 'dispatched' && (!g.suggestedVehicle || !g.suggestedVehicle.number || g.suggestedVehicle.number === '—'));
    if (missing.length > 0) {
      toast({
        title: `Assign vehicles to all trips first`,
        description: `${missing.length} trip(s) have no vehicle selected.`,
        variant: 'destructive',
      });
      return;
    }
    const updated = tripGroups.map(g => ({ ...g, status: 'dispatched' as const }));
    setTripGroups(updated);
    try {
      await persistDispatchedTrips(updated);
      setStep('dispatch');
      toast({ title: `All ${updated.length} trips dispatched & saved!` });
    } catch {
      setStep('dispatch');
      toast({ title: 'Dispatched locally but failed to save to database', variant: 'destructive' });
    }
  };

  // Admin moves a worker from one trip to another (or to a brand-new trip).
  const handleMoveWorker = (fromGroupId: string, workerId: string, toGroupId: string) => {
    setTripGroups(prev => {
      const fromGroup = prev.find(g => g.id === fromGroupId);
      if (!fromGroup) return prev;
      const worker = fromGroup.workers.find(w => w.id === workerId);
      if (!worker) return prev;

      const recalc = (g: TripGroup): TripGroup => {
        const cap = g.suggestedVehicle?.capacity || Math.max(g.workers.length, 1);
        const utilization = g.workers.length / cap;
        return { ...g, utilization, isInefficient: utilization < MIN_UTILIZATION && !g.isUrgent };
      };

      // Remove from source
      let updated = prev.map(g => g.id === fromGroupId
        ? { ...g, workers: g.workers.filter(w => w.id !== workerId), sites: [...new Set(g.workers.filter(w => w.id !== workerId).map(w => w.site))] }
        : g
      );

      if (toGroupId === '__new__') {
        const area = getAreaCluster(worker.site);
        const newGroup: TripGroup = {
          id: `TRP-NEW-${Date.now()}`,
          area,
          sites: [worker.site],
          workers: [worker],
          timeSlot: worker.timeSlot,
          suggestedVehicle: null,
          status: 'pending',
          utilization: 0,
          isInefficient: true,
          isUrgent: !!worker.urgent,
        };
        updated = [...updated, newGroup];
      } else {
        updated = updated.map(g => g.id === toGroupId
          ? { ...g, workers: [...g.workers, worker], sites: [...new Set([...g.sites, worker.site])] }
          : g
        );
      }

      // Drop emptied non-completed groups
      updated = updated.filter(g => g.workers.length > 0 || g.status === 'completed');
      return updated.map(recalc);
    });
    toast({ title: 'Worker reassigned' });
  };

  // Admin picks a real vehicle from the fleet → applies real capacity, driver, type.
  const handleSelectVehicle = (groupId: string, vehicleId: string) => {
    setTripGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      if (!vehicleId) {
        return { ...g, suggestedVehicle: null, utilization: 0, isInefficient: false };
      }
      const v = vehicleList.find(x => x.id === vehicleId);
      if (!v) return g;
      const utilization = v.capacity > 0 ? g.workers.length / v.capacity : 0;
      return {
        ...g,
        suggestedVehicle: {
          id: v.id,
          number: v.number,
          type: v.type,
          capacity: v.capacity,
          driver: v.driver || '',
        },
        utilization,
        isInefficient: utilization < MIN_UTILIZATION && !g.isUrgent,
      };
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

  // Workers whose trip is already completed should disappear from the
  // Review/Optimize/Dispatch views so dispatchers only act on pending work.
  const keyForWorker = (w: TripWorker) =>
    buildCompletedWorkerKey(w.projectId || null, w.projectName || '', w.site, w.name);

  const visibleWorkers = useMemo(
    () => workers.filter(w => !completedWorkerKeys.has(keyForWorker(w))),
    [workers, completedWorkerKeys]
  );
  const hiddenCompletedCount = workers.length - visibleWorkers.length;

  // Keep completed trip groups visible (so admin sees "Completed" cards with timestamps),
  // but for in-progress / pending groups, filter out workers whose trips are already done.
  const visibleTripGroups = useMemo(() => {
    if (completedWorkerKeys.size === 0) return tripGroups;
    return tripGroups
      .map(g => {
        if (g.status === 'completed') return g; // preserve completed cards as-is
        return { ...g, workers: g.workers.filter(w => !completedWorkerKeys.has(keyForWorker(w))) };
      })
      .filter(g => g.status === 'completed' || g.workers.length > 0);
  }, [tripGroups, completedWorkerKeys]);

  const filteredGroups = activeSlot === 'All' ? visibleTripGroups : visibleTripGroups.filter(g => g.timeSlot === activeSlot);

  const workersBySlot = useMemo(() => {
    const map: Record<string, number> = {};
    TIME_SLOTS.forEach(s => { map[s] = visibleWorkers.filter(w => w.timeSlot === s).length; });
    return map;
  }, [visibleWorkers]);

  const workersBySite = useMemo(() => {
    const map: Record<string, TripWorker[]> = {};
    visibleWorkers.forEach(w => { const area = getAreaCluster(w.site); if (!map[area]) map[area] = []; map[area].push(w); });
    return map;
  }, [visibleWorkers]);

  const visibleSteps = STEPS;

  // Load engineer requests for selected date
  const loadRequests = useCallback(async () => {
    try {
      const reqs = await fetchTripRequestsByDate(toDateStr(selectedDate));
      setTripRequests(reqs);
      try {
        const live = await fetchRequestLiveStatuses(toDateStr(selectedDate), reqs);
        setRequestLiveStatus(live);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [selectedDate]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Auto-refresh request live statuses every 30s so admin sees driver progress
  useEffect(() => {
    if (tripRequests.length === 0) return;
    const t = setInterval(async () => {
      try {
        const live = await fetchRequestLiveStatuses(toDateStr(selectedDate), tripRequests);
        setRequestLiveStatus(live);
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(t);
  }, [tripRequests, selectedDate]);

  // Generate workers from engineer requests
  // Map an engineer-supplied start_time ("HH:MM" or "HH:MM:SS", 12/24h) to the
  // nearest configured trip time slot. Falls back to the admin's default slot
  // only when the engineer didn't provide a time.
  const slotFromEngineerTime = (raw?: string | null): string => {
    if (!raw) return defaultTimeSlot;
    const s = String(raw).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!m) return defaultTimeSlot;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3]?.toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const target = h * 60 + min;
    const toMinutes = (slot: string) => {
      const mm = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!mm) return 0;
      let hh = parseInt(mm[1], 10);
      const mn = parseInt(mm[2], 10);
      const a = mm[3].toUpperCase();
      if (a === 'PM' && hh < 12) hh += 12;
      if (a === 'AM' && hh === 12) hh = 0;
      return hh * 60 + mn;
    };
    let best = TIME_SLOTS[0];
    let bestDiff = Infinity;
    TIME_SLOTS.forEach(slot => {
      const d = Math.abs(toMinutes(slot) - target);
      if (d < bestDiff) { bestDiff = d; best = slot; }
    });
    return best;
  };

  const handleGenerateFromRequests = () => {
    if (tripRequests.length === 0) {
      toast({ title: 'No engineer submissions for this date', variant: 'destructive' });
      return;
    }

    const gen: TripWorker[] = [];
    const seen = new Set<string>();
    let skippedCompleted = 0;
    let skippedInProgress = 0;
    let skippedDispatched = 0;
    tripRequests.filter(r => r.status === 'pending' || r.status === 'approved').forEach(req => {
      // Once a trip has been dispatched it should be view-only. Do not regenerate
      // it into Optimize again, otherwise the admin sees the same trip as pending.
      const live = requestLiveStatus.get(req.id);
      if (live?.status === 'completed') { skippedCompleted++; return; }
      if (live?.status === 'in_progress') { skippedInProgress++; return; }
      if (live?.status === 'assigned') { skippedDispatched++; return; }

      const names = (req.worker_names || []).filter(n => n && n.trim());
      // No-personnel request: still create a placeholder so the trip flows through dispatch.
      if (names.length === 0) {
        gen.push({
          id: `TW-REQ-${req.id}-NP`,
          name: '— No personnel —',
          site: req.site || 'Unassigned',
          department: req.work_type || 'General',
          timeSlot: slotFromEngineerTime(req.start_time),

          startTime: req.start_time || '',
          endTime: req.end_time || '',
          urgent: req.priority === 'High',
          projectId: req.project_id,
          projectName: req.project_name,
          engineerName: req.engineer_name || '',
          pickupLocation: req.pickup_location || 'Al Quoz Labour Camp',
          notes: req.notes || '',
          noPersonnel: true,
          requestedVehicleNumber: req.vehicle_number || null,
          requestedDriver: req.driver_name || null,
          executionOrder: req.execution_order ?? null,
        });
        return;
      }
      names.forEach((name, idx) => {
        const key = `${name.trim().toUpperCase()}-${req.site}`;
        if (seen.has(key)) return;
        seen.add(key);
        const masterWorker = workerList.find(w => w.name.toLowerCase() === name.trim().toLowerCase());
        gen.push({
          id: `TW-REQ-${req.id}-${idx}`,
          name: name.trim(),
          site: req.site || 'Unassigned',
          department: masterWorker?.department || req.work_type || 'General',
          timeSlot: slotFromEngineerTime(req.start_time),

          startTime: req.start_time || '',
          endTime: req.end_time || '',
          urgent: req.priority === 'High',
          projectId: req.project_id,
          projectName: req.project_name,
          engineerName: req.engineer_name || '',
          pickupLocation: req.pickup_location || 'Al Quoz Labour Camp',
          notes: req.notes || '',
          requestedVehicleNumber: req.vehicle_number || null,
          requestedDriver: req.driver_name || null,
          executionOrder: req.execution_order ?? null,
        });
      });
    });
    if (gen.length === 0) {
      const reason = skippedCompleted + skippedInProgress + skippedDispatched > 0
        ? `${skippedDispatched} already dispatched, ${skippedInProgress} already started, ${skippedCompleted} completed — nothing new to generate.`
        : 'No new submissions for this date';
      if (skippedDispatched + skippedInProgress + skippedCompleted > 0) setStep('dispatch');
      toast({ title: 'Nothing to generate', description: reason, variant: 'destructive' });
      return;
    }
    setWorkers(gen);
    setGenerated(true);
    setSaved(false);
    setStep('review');
    const skipNote = (skippedCompleted + skippedInProgress + skippedDispatched) > 0
      ? ` · skipped ${skippedDispatched} dispatched${skippedInProgress ? `, ${skippedInProgress} in progress` : ''}${skippedCompleted ? `, ${skippedCompleted} completed` : ''}`
      : '';
    toast({ title: `Generated ${gen.length} trip${gen.length === 1 ? '' : 's'}${skipNote}` });
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
                  {[...tripRequests]
                    .sort((a, b) => {
                      // Group by engineer, then by execution_order within engineer
                      const eng = (a.engineer_name || '').localeCompare(b.engineer_name || '');
                      if (eng !== 0) return eng;
                      return (a.execution_order ?? 9999) - (b.execution_order ?? 9999);
                    })
                    .map(req => {
                    const live = requestLiveStatus.get(req.id);
                    const liveStatus = live?.status;
                    const chipLabel = liveStatus === 'completed' ? 'Completed'
                      : liveStatus === 'in_progress' ? 'In Progress'
                      : liveStatus === 'assigned' ? 'Dispatched'
                      : req.status;
                    const chipClass = liveStatus === 'completed' ? 'bg-success/10 text-success'
                      : liveStatus === 'in_progress' ? 'bg-accent/15 text-accent-foreground'
                      : liveStatus === 'assigned' ? 'bg-primary/10 text-primary'
                      : req.status === 'pending' ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success';
                    const fmtTime = (iso: string | null) =>
                      iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
                    return (
                    <div key={req.id} className={`p-4 rounded-md border transition-colors ${req.status === 'pending' && !liveStatus ? 'border-accent/40 bg-accent/5' : 'border-border'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {req.execution_order != null && (
                              <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                #{req.execution_order}
                              </span>
                            )}
                            <span className="text-sm font-medium">{req.project_name}</span>
                            <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{req.work_type || 'General'}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${chipClass}`}>
                              {chipLabel}
                            </span>
                            {live?.vehicle_number && (
                              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">🚐 {live.vehicle_number}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.site}</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {(req.worker_names || []).length} workers</span>
                            <span className="flex items-center gap-1"><UserCog className="h-3 w-3" /> {req.engineer_name}</span>
                            {req.pickup_location && (
                              <span className="flex items-center gap-1" title="Pickup point">
                                <Bus className="h-3 w-3" /> from {req.pickup_location}
                              </span>
                            )}
                            {live?.started_at && (
                              <span className="flex items-center gap-1 text-accent"><Clock className="h-3 w-3" /> Started {fmtTime(live.started_at)}</span>
                            )}
                            {live?.completed_at && (
                              <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Completed {fmtTime(live.completed_at)}</span>
                            )}
                          </div>
                          {/* Engineer suggestions (if any) */}
                          {(req.start_time || req.end_time || req.vehicle_number || req.driver_name) && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Engineer suggests:</span>
                              {(req.start_time || req.end_time) && (
                                <span className="text-xs bg-accent/10 text-accent-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {req.start_time || '—'} → {req.end_time || '—'}
                                </span>
                              )}
                              {req.vehicle_number && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">🚐 {req.vehicle_number}{req.vehicle_type ? ` · ${req.vehicle_type}` : ''}</span>
                              )}
                              {req.driver_name && (
                                <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <UserCog className="h-3 w-3" /> {req.driver_name}
                                </span>
                              )}
                            </div>
                          )}
                          {(req.worker_names || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(req.worker_names || []).map((n, i) => (
                                <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{n}</span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2">
                              <span className="text-[10px] uppercase tracking-wide font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded">
                                No personnel assigned
                              </span>
                            </div>
                          )}
                          {req.notes && req.notes.trim() && (
                            <div className="mt-2 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">Engineer note</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{req.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
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
                  <h2 className="font-semibold">
                    Assignments — {format(selectedDate, 'MMM d, yyyy')} ({visibleWorkers.length}
                    {hiddenCompletedCount > 0 && (
                      <span className="text-success font-normal"> · {hiddenCompletedCount} completed hidden</span>
                    )})
                  </h2>
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
                    {(activeSlot === 'All' ? visibleWorkers : visibleWorkers.filter(w => w.timeSlot === activeSlot)).map(w => (
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
            {(() => {
              // Compute first trip of the day per driver — that one starts from Al Quoz Camp.
              const slotIndex = (s: string) => TIME_SLOTS.indexOf(s);
              const firstTripIdByDriver = new Map<string, string>();
              const sortedAll = [...tripGroups].sort((a, b) => slotIndex(a.timeSlot) - slotIndex(b.timeSlot));
              sortedAll.forEach(t => {
                const drv = t.suggestedVehicle?.driver || getDefaultDriverForArea(t.area);
                if (!drv) return;
                if (!firstTripIdByDriver.has(drv)) firstTripIdByDriver.set(drv, t.id);
              });
              return filteredGroups.map(g => {
                const defaultDriver = getDefaultDriverForArea(g.area);
                const currentDriver = g.suggestedVehicle?.driver || defaultDriver;
                const startsFromCamp = !!currentDriver && firstTripIdByDriver.get(currentDriver) === g.id;
                return (
                <div key={g.id} className={`kpi-card ${g.isInefficient ? 'border-warning/40' : ''} ${g.status === 'completed' ? 'border-success/40 bg-success/5' : g.status === 'in_progress' ? 'border-accent/40' : g.status === 'dispatched' ? 'opacity-80' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold flex items-center gap-1.5"><Bus className="h-4 w-4 text-accent" /> {g.area}</h3>
                      <p className="text-xs text-muted-foreground">{g.timeSlot} • {g.workers.length} workers</p>
                      {startsFromCamp && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium border border-accent/20">
                          <MapPin className="h-2.5 w-2.5" /> Starts from Al Quoz Camp
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {g.isUrgent && <AlertTriangle className="h-4 w-4 text-warning" />}
                      {g.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold uppercase tracking-wide">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {g.status === 'in_progress' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wide animate-pulse">
                          <Clock className="h-3 w-3" /> In Progress
                        </span>
                      )}
                      {g.status === 'dispatched' && <CheckCircle2 className="h-4 w-4 text-success" />}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {/* Per-worker details: project, site, engineer, pickup, notes + reassign */}
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {g.workers.map(w => {
                        const canMove = g.status !== 'dispatched' && g.status !== 'in_progress' && g.status !== 'completed';
                        const moveTargets = tripGroups.filter(t =>
                          t.id !== g.id &&
                          t.timeSlot === g.timeSlot &&
                          t.status !== 'dispatched' && t.status !== 'in_progress' && t.status !== 'completed'
                        );
                        return (
                          <div key={w.id} className="rounded border border-border/60 bg-background/40 px-2 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">{w.name}</p>
                                {w.projectName && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                                    <FolderKanban className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{w.projectName}</span>
                                  </p>
                                )}
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{w.site}</span>
                                </p>
                                {w.engineerName && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                                    <UserCog className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{w.engineerName}</span>
                                  </p>
                                )}
                                {w.pickupLocation && w.pickupLocation !== 'Al Quoz Labour Camp' && (
                                  <p className="text-[10px] text-muted-foreground truncate">Pickup: {w.pickupLocation}</p>
                                )}
                                {w.notes && (
                                  <p className="text-[10px] text-warning truncate" title={w.notes}>📝 {w.notes}</p>
                                )}
                              </div>
                              {canMove && (
                                <select
                                  value=""
                                  onChange={e => { if (e.target.value) handleMoveWorker(g.id, w.id, e.target.value); }}
                                  className="shrink-0 px-1 py-0.5 rounded border border-input bg-background text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                                  title="Reassign to another trip in same time slot"
                                >
                                  <option value="">Move…</option>
                                  {moveTargets.map(t => (
                                    <option key={t.id} value={t.id}>→ {t.area} ({t.workers.length})</option>
                                  ))}
                                  <option value="__new__">→ New trip</option>
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vehicle assignment from real fleet */}
                    <div className="space-y-1.5 bg-muted/20 px-2 py-2 rounded">
                      <div className="flex items-center gap-2 text-xs">
                        <Bus className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Vehicle:</span>
                        {g.status !== 'dispatched' ? (
                          <select
                            value={g.suggestedVehicle?.id && !g.suggestedVehicle.id.startsWith('manual-') ? g.suggestedVehicle.id : ''}
                            onChange={e => handleSelectVehicle(g.id, e.target.value)}
                            className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            <option value="">— Select vehicle —</option>
                            {vehicleList
                              .filter(v => v.status !== 'Maintenance')
                              .map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.number} · {v.type} (cap {v.capacity}){v.driver ? ` · ${v.driver}` : ''}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="font-medium">
                            {g.suggestedVehicle ? `${g.suggestedVehicle.number} · ${g.suggestedVehicle.type}` : 'Unassigned'}
                          </span>
                        )}
                      </div>
                      {g.suggestedVehicle && g.suggestedVehicle.number !== '—' && (
                        <>
                          <div className="flex items-center gap-2 text-xs">
                            <UserCog className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Driver:</span>
                            <span className="font-medium">{g.suggestedVehicle.driver || 'No driver linked to vehicle'}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Capacity {g.workers.length}/{g.suggestedVehicle.capacity}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(g.utilization * 100, 100)} className="h-1.5 w-12" />
                              <span>{Math.round(g.utilization * 100)}%</span>
                            </div>
                          </div>
                          {g.workers.length > g.suggestedVehicle.capacity && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Overbooked by {g.workers.length - g.suggestedVehicle.capacity} — pick a larger vehicle.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {g.isInefficient && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low utilization — consider merging</p>}

                    {(g.startedAt || g.completedAt) && (
                      <div className="space-y-1 pt-2 border-t border-border text-xs">
                        {g.startedAt && (
                          <div className="flex items-center gap-2 text-accent">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">Started:</span>
                            <span>{new Date(g.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        {g.completedAt && (
                          <div className="flex items-center gap-2 text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="font-medium">Completed:</span>
                            <span>{new Date(g.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {g.startedAt && (
                              <span className="text-muted-foreground">
                                ({Math.round((new Date(g.completedAt).getTime() - new Date(g.startedAt).getTime()) / 60000)} min)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {g.status !== 'dispatched' && g.status !== 'in_progress' && g.status !== 'completed' && (
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button
                          onClick={() => handleDispatch(g.id)}
                          disabled={!g.suggestedVehicle || g.suggestedVehicle.number === '—'}
                          title={!g.suggestedVehicle || g.suggestedVehicle.number === '—' ? 'Select a vehicle first' : ''}
                          className="flex-1 px-2 py-1.5 rounded bg-accent text-accent-foreground text-xs hover:bg-accent/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                          <CheckCircle2 className="h-3 w-3" /> Dispatch
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
            })()}
          </div>
          {tripGroups.some(g => !['dispatched', 'in_progress', 'completed'].includes(g.status)) && (
            <div className="flex justify-end">
              <button onClick={handleDispatchAll} className="px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Dispatch All Trips
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'dispatch' && (() => {
        const dispatchedTrips = tripGroups.filter(g => ['dispatched', 'in_progress', 'completed'].includes(g.status));
        const pendingTrips = tripGroups.filter(g => !['dispatched', 'in_progress', 'completed'].includes(g.status));
        const dispatchedWorkerCount = dispatchedTrips.reduce((sum, g) => sum + g.workers.length, 0);
        const statusPill = (s: string) => {
          if (s === 'completed') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold uppercase"><CheckCircle2 className="h-3 w-3" /> Completed</span>;
          if (s === 'in_progress') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-bold uppercase animate-pulse"><Clock className="h-3 w-3" /> In Progress</span>;
          return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/15 text-info text-[10px] font-bold uppercase"><CheckCircle2 className="h-3 w-3" /> Dispatched</span>;
        };
        return (
          <div className="space-y-4">
            <div className="kpi-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" /> Dispatched Trips</h2>
                <p className="text-muted-foreground text-sm">
                  {dispatchedTrips.length} of {tripGroups.length} trips dispatched • {dispatchedWorkerCount} workers assigned • {format(selectedDate, 'MMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={() => setStep('optimize')}
                className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 self-start sm:self-auto"
              >
                ← Back to Trip Cards
              </button>
            </div>

            {dispatchedTrips.length === 0 ? (
              <div className="kpi-card text-center py-8 text-sm text-muted-foreground">No trips dispatched yet.</div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dispatchedTrips.map(g => {
                  const projects = [...new Set(g.workers.map(w => w.projectName).filter(Boolean))];
                  const engineers = [...new Set(g.workers.map(w => w.engineerName).filter(Boolean))];
                  return (
                    <div key={g.id} className={`kpi-card ${g.status === 'completed' ? 'border-success/40 bg-success/5' : g.status === 'in_progress' ? 'border-accent/40' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold flex items-center gap-1.5"><Bus className="h-4 w-4 text-accent" /> {g.area}</h3>
                          <p className="text-xs text-muted-foreground">{g.timeSlot} • {g.workers.length} worker{g.workers.length !== 1 ? 's' : ''}</p>
                        </div>
                        {statusPill(g.status)}
                      </div>

                      <div className="space-y-1.5 text-xs bg-muted/20 px-2 py-2 rounded mb-2">
                        <div className="flex items-center gap-2">
                          <Bus className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Vehicle:</span>
                          <span className="font-medium">{g.suggestedVehicle ? `${g.suggestedVehicle.number} · ${g.suggestedVehicle.type}` : 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCog className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Driver:</span>
                          <span className="font-medium">{g.suggestedVehicle?.driver || '—'}</span>
                        </div>
                        {engineers.length > 0 && (
                          <div className="flex items-start gap-2">
                            <UserCog className="h-3 w-3 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground">Engineer:</span>
                            <span className="font-medium">{engineers.join(', ')}</span>
                          </div>
                        )}
                        {projects.length > 0 && (
                          <div className="flex items-start gap-2">
                            <FolderKanban className="h-3 w-3 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground">Project:</span>
                            <span className="font-medium truncate">{projects.join(', ')}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground">Sites:</span>
                          <span className="font-medium truncate">{g.sites.join(', ')}</span>
                        </div>
                      </div>

                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {g.workers.map(w => (
                          <div key={w.id} className="text-[11px] flex items-center justify-between border-b border-border/40 last:border-0 py-0.5">
                            <span className="font-medium truncate">{w.name}</span>
                            <span className="text-muted-foreground truncate ml-2">{w.site}</span>
                          </div>
                        ))}
                      </div>

                      {(g.startedAt || g.completedAt) && (
                        <div className="space-y-1 pt-2 mt-2 border-t border-border text-xs">
                          {g.startedAt && (
                            <div className="flex items-center gap-2 text-accent">
                              <Clock className="h-3 w-3" />
                              <span>Started {new Date(g.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                          {g.completedAt && (
                            <div className="flex items-center gap-2 text-success">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Completed {new Date(g.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pendingTrips.length > 0 && (
              <div className="kpi-card border-warning/40">
                <p className="text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning inline mr-1" />
                  <strong>{pendingTrips.length}</strong> trip{pendingTrips.length !== 1 ? 's' : ''} still pending dispatch.{' '}
                  <button onClick={() => setStep('optimize')} className="text-accent underline">Return to Optimize</button> to dispatch the rest.
                </p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
