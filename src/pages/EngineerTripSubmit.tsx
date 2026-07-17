import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjects, fetchVehicles } from '@/lib/supabaseData';
import { fetchMyTripRequests, submitTripRequests, type TripRequestInput } from '@/lib/tripRequestsData';
import { parseTripRequestsExcel, downloadTripRequestsTemplate } from '@/lib/excelImport';
import type { Project, Vehicle } from '@/data/mockData';
import { format, subDays, addDays } from 'date-fns';
import { CalendarIcon, CheckCircle2, FolderKanban, MapPin, Users, Send, Loader2, Plus, Trash2, Clock, Truck, UserCog, ArrowUp, ArrowDown, AlertTriangle, X, Upload, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const DEFAULT_PICKUP = 'Al Quoz Labour Camp';

type TripDraft = {
  tempId: string;
  project_id: string;
  worker_names: string[];
  start_time: string;
  end_time: string;
  vehicle_number: string;
  driver_name: string;
  notes: string;
  pickup_location: string;
  pickup_custom: boolean; // when true, pickup_location is free text
  // Free-text overrides used when the row came from an Excel upload with a
  // project name that doesn't match any existing project. When set, project_id
  // is left blank and these values are submitted verbatim.
  custom_project_name?: string;
  custom_site?: string;
  custom_work_type?: string;
};

const newDraft = (): TripDraft => ({
  tempId: crypto.randomUUID(),
  project_id: '',
  worker_names: [],
  start_time: '',
  end_time: '',
  vehicle_number: '',
  driver_name: '',
  notes: '',
  pickup_location: DEFAULT_PICKUP,
  pickup_custom: false,
});

export default function EngineerTripSubmit() {
  const { user, profileName } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [drafts, setDrafts] = useState<TripDraft[]>([]);
  const [customNameInputs, setCustomNameInputs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  // (formCleared removed — the form no longer auto-hydrates prior submissions.)


  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Load all active/scheduled projects across departments — any engineer can
  // submit trip requests for any project, regardless of which engineer "owns" it.
  useEffect(() => {
    fetchProjects().then(all => {
      const available = all.filter(p =>
        (p.status === 'Active' || p.status === 'Scheduled') &&
        (p.workerNames || []).length > 0
      );
      setProjects(available);
    }).catch(() => {});
    fetchVehicles().then(setVehicles).catch(() => {});
  }, []);




  // Count previously-submitted requests for this date (shown as an info banner).
  // The form does NOT auto-hydrate them anymore — engineers open the page with
  // a blank slate for new entries, and click "Load previous submissions" if
  // they explicitly want to edit them.
  const [priorCount, setPriorCount] = useState(0);
  const loadExisting = useCallback(async (hydrate = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const existing = await fetchMyTripRequests(dateStr, user.id);
      setPriorCount(existing.length);
      if (hydrate && existing.length > 0) {
        const ordered = [...existing].sort((a, b) =>
          (a.execution_order ?? 9999) - (b.execution_order ?? 9999),
        );
        setDrafts(ordered.map(r => {
          const pickup = r.pickup_location || DEFAULT_PICKUP;
          const hasProject = r.project_id && projects.some(p => p.id === r.project_id);
          return {
            tempId: r.id,
            project_id: hasProject ? r.project_id : '',
            worker_names: r.worker_names || [],
            start_time: r.start_time || '',
            end_time: r.end_time || '',
            vehicle_number: r.vehicle_number || '',
            driver_name: r.driver_name || '',
            notes: r.notes || '',
            pickup_location: pickup,
            pickup_custom: pickup !== DEFAULT_PICKUP && !(projects.some(p => (p.site || '').trim() === pickup.trim())),
            custom_project_name: hasProject ? undefined : (r.project_name || ''),
            custom_site: hasProject ? undefined : (r.site || ''),
            custom_work_type: hasProject ? undefined : (r.work_type || ''),
          };
        }));
        setSubmitted(true);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateStr, user, projects]);

  // On date change: clear drafts and just refresh the "prior count" banner.
  useEffect(() => {
    setDrafts([]);
    setSubmitted(false);
    setCustomNameInputs({});
    loadExisting(false);
  }, [dateStr, user]); // eslint-disable-line react-hooks/exhaustive-deps


  const updateDraft = (id: string, patch: Partial<TripDraft>) => {
    setDrafts(prev => prev.map(d => d.tempId === id ? { ...d, ...patch } : d));
    setSubmitted(false);
  };

  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.tempId !== id));
    setSubmitted(false);
  };

  const addDraft = () => {
    setDrafts(prev => [...prev, newDraft()]);
    setSubmitted(false);
  };

  const onVehicleChange = (id: string, vehicleNumber: string) => {
    const v = vehicles.find(x => x.number === vehicleNumber);
    updateDraft(id, {
      vehicle_number: vehicleNumber,
      driver_name: v?.driver || '',
    });
  };

  const moveDraft = (id: string, dir: -1 | 1) => {
    setDrafts(prev => {
      const idx = prev.findIndex(d => d.tempId === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSubmitted(false);
  };

  const setOrder = (id: string, raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setDrafts(prev => {
      const fromIdx = prev.findIndex(d => d.tempId === id);
      if (fromIdx < 0) return prev;
      const toIdx = Math.min(prev.length - 1, n - 1);
      if (fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setSubmitted(false);
  };

  // Pickup dropdown: Al Quoz Camp + unique sites from engineer's projects + "Custom..."
  const pickupOptions = useMemo(() => {
    const sites = Array.from(new Set(
      projects.map(p => (p.site || '').trim()).filter(s => s && s !== DEFAULT_PICKUP)
    )).sort();
    return [DEFAULT_PICKUP, ...sites];
  }, [projects]);

  // Map worker name -> count of trips it appears on (for duplicate warnings)
  const workerOccurrences = useMemo(() => {
    const map = new Map<string, number>();
    drafts.forEach(d => {
      d.worker_names.forEach(n => {
        const key = n.trim().toUpperCase();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return map;
  }, [drafts]);

  const validate = (): string | null => {
    if (drafts.length === 0) return 'Add at least one trip';
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const hasCustomProject = (d.custom_project_name || '').trim().length > 0;
      if (!d.project_id && !hasCustomProject) return `Trip ${i + 1}: select a project`;
      if (d.worker_names.length === 0 && !d.notes.trim()) {
        return `Trip ${i + 1}: add workers, or fill Notes with the reason (e.g. site inspection, material drop)`;
      }
      if (!d.pickup_location.trim()) return `Trip ${i + 1}: pickup location required`;
      // End time is captured by the driver, not by the engineer, so no
      // start/end ordering check is needed here.
    }
    return null;
  };

  const addCustomWorker = (id: string) => {
    const raw = (customNameInputs[id] || '').trim();
    if (!raw) return;
    setDrafts(prev => prev.map(d => {
      if (d.tempId !== id) return d;
      // Avoid exact duplicate within the same trip (case-insensitive)
      const exists = d.worker_names.some(n => n.trim().toUpperCase() === raw.toUpperCase());
      return exists ? d : { ...d, worker_names: [...d.worker_names, raw] };
    }));
    setCustomNameInputs(prev => ({ ...prev, [id]: '' }));
    setSubmitted(false);
  };

  const removeWorker = (id: string, name: string) => {
    setDrafts(prev => prev.map(d =>
      d.tempId === id ? { ...d, worker_names: d.worker_names.filter(n => n !== name) } : d
    ));
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const err = validate();
    if (err) { toast({ title: err, variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const payload: TripRequestInput[] = drafts.map((d, idx) => {
        const p = projects.find(x => x.id === d.project_id);
        const v = vehicles.find(x => x.number === d.vehicle_number);
        return {
          project_id: d.project_id || '',
          project_name: p?.name || d.custom_project_name || '',
          site: p?.site || d.custom_site || '',
          worker_names: d.worker_names,
          work_type: p?.workType || d.custom_work_type || '',
          // Priority is now derived from execution order (lower # = higher priority)
          priority: idx === 0 ? 'High' : idx <= 2 ? 'Medium' : 'Low',
          notes: d.notes,
          start_time: d.start_time || null,
          end_time: null, // captured by driver on trip completion
          vehicle_number: d.vehicle_number || null,
          vehicle_type: v?.type || null,
          driver_name: d.driver_name || null,
          pickup_location: d.pickup_location || DEFAULT_PICKUP,
          execution_order: idx + 1,
        };
      });
      await submitTripRequests(dateStr, user.id, profileName || user.email || '', payload);
      setSubmitted(true);
      toast({ title: `Submitted ${payload.length} trip${payload.length === 1 ? '' : 's'} for ${format(selectedDate, 'MMM d, yyyy')}` });
    } catch {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearAll = () => {
    if (drafts.length === 0) return;
    if (!window.confirm('Reset the form for a new entry? Your already-submitted trip history for this date is kept and stays visible in "My Trip Requests".')) return;
    setDrafts([]);
    setCustomNameInputs({});
    setSubmitted(false);


    toast({ title: 'Form reset — ready for a new entry' });
  };

  // ===== Bulk upload from Excel =====
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always reset so re-selecting the same file still triggers onChange
    if (e.target) e.target.value = '';
    if (!file) return;

    try {
      const rows = await parseTripRequestsExcel(file);
      if (rows.length === 0) {
        toast({ title: 'No trips found in the file', description: 'Make sure rows are filled in under the template headers.', variant: 'destructive' });
        return;
      }

      // Project lookup: name OR code, case-insensitive
      const projectByKey = new Map<string, Project>();
      projects.forEach(p => {
        if (p.name) projectByKey.set(p.name.trim().toLowerCase(), p);
        if (p.code) projectByKey.set(p.code.trim().toLowerCase(), p);
      });

      const newDrafts: TripDraft[] = [];
      let newProjectCount = 0;

      rows
        .slice()
        .sort((a, b) => (a.execution_order ?? 9999) - (b.execution_order ?? 9999))
        .forEach((row) => {
          const proj = projectByKey.get((row.project || '').trim().toLowerCase());
          const veh = vehicles.find(v => row.vehicle_number && v.number.trim().toLowerCase() === row.vehicle_number.trim().toLowerCase());
          const pickup = row.pickup_location || DEFAULT_PICKUP;
          if (proj) {
            newDrafts.push({
              tempId: crypto.randomUUID(),
              project_id: proj.id,
              worker_names: row.workers,
              start_time: row.start_time,
              end_time: row.end_time,
              vehicle_number: veh?.number || row.vehicle_number || '',
              driver_name: row.driver_name || veh?.driver || '',
              notes: row.notes,
              pickup_location: pickup,
              pickup_custom: pickup !== DEFAULT_PICKUP && !projects.some(p => (p.site || '').trim() === pickup.trim()),
            });
          } else {
            // Unknown project — accept the row as-is, using the Excel values verbatim.
            newProjectCount += 1;
            newDrafts.push({
              tempId: crypto.randomUUID(),
              project_id: '',
              worker_names: row.workers,
              start_time: row.start_time,
              end_time: row.end_time,
              vehicle_number: veh?.number || row.vehicle_number || '',
              driver_name: row.driver_name || veh?.driver || '',
              notes: row.notes,
              pickup_location: pickup,
              pickup_custom: pickup !== DEFAULT_PICKUP && !projects.some(p => (p.site || '').trim() === pickup.trim()),
              custom_project_name: row.project || '',
              custom_site: row.project_location || '',
              custom_work_type: row.department || '',
            });
          }
        });

      if (newDrafts.length === 0) {
        toast({
          title: 'No rows found in the file',
          description: 'Fill in the template rows and try again.',
          variant: 'destructive',
        });
        return;
      }

      setDrafts(newDrafts);
      setSubmitted(false);

      toast({
        title: `Loaded ${newDrafts.length} trip${newDrafts.length === 1 ? '' : 's'} from Excel`,
        description: newProjectCount > 0
          ? `${newProjectCount} row(s) use a project not in the system — submitted as-is.`
          : 'Review the trips, then click Submit.',
      });
    } catch (err) {
      console.error('Excel upload failed', err);
      toast({ title: 'Could not read the Excel file', description: 'Please use the provided template.', variant: 'destructive' });
    }
  };

  const totalWorkers = useMemo(() => drafts.reduce((s, d) => s + d.worker_names.length, 0), [drafts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submit Trip Requests</h1>
          <p className="text-muted-foreground text-sm">Build one or more trips per day. Vehicle, driver and time are suggestions — dispatcher may adjust.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadTripRequestsTemplate}
            title="Download the Excel template for bulk trip request uploads"
            className="text-xs px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || projects.length === 0}
            title="Upload a filled-in Excel template to create multiple trips at once"
            className="text-xs px-3 py-2 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 flex items-center gap-1.5 disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> Upload Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleExcelUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Date picker */}
      <div className="kpi-card flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Trip Date:</span>
        </div>
        <div className="flex items-center gap-2">
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
              <Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">→</button>
          <button onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90">Today</button>
        </div>
        {submitted && (
          <span className="text-xs text-success flex items-center gap-1 sm:ml-auto">
            <CheckCircle2 className="h-3 w-3" /> Submitted
          </span>
        )}
      </div>

      {loading ? (
        <div className="kpi-card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="kpi-card text-center py-12">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold">No Projects Available</h2>
          <p className="text-sm text-muted-foreground mt-1">There are no active or scheduled projects with workers to dispatch.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {drafts.length} trip{drafts.length === 1 ? '' : 's'} • {totalWorkers} worker{totalWorkers === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              {drafts.length > 0 && (
                <button onClick={handleClearAll} disabled={submitting}
                  title="Reset the form for a new entry — your submitted trip history is kept"
                  className="text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1 disabled:opacity-50">
                  <Trash2 className="h-3 w-3" /> Reset Form
                </button>
              )}
              <button onClick={addDraft}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Trip
              </button>
            </div>
          </div>

          {drafts.length === 0 && (
            <div className="kpi-card text-center py-10">
              <p className="text-sm text-muted-foreground mb-3">No trips yet. Click "Add Trip" to begin.</p>
              <button onClick={addDraft}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 inline-flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Trip
              </button>
            </div>
          )}

          <div className="space-y-3">
            {drafts.map((d, idx) => {
              const project = projects.find(p => p.id === d.project_id);
              const allWorkers = project?.workerNames || [];
              return (
                <div key={d.tempId} className="kpi-card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold">Trip {idx + 1}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveDraft(d.tempId, -1)}
                        disabled={idx === 0}
                        title="Move up (run earlier)"
                        className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveDraft(d.tempId, 1)}
                        disabled={idx === drafts.length - 1}
                        title="Move down (run later)"
                        className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeDraft(d.tempId)}
                        title="Remove this trip"
                        className="text-destructive hover:bg-destructive/10 p-1 rounded ml-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Project */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Project</label>
                      {(d.custom_project_name !== undefined) ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={d.custom_project_name}
                            onChange={e => updateDraft(d.tempId, { custom_project_name: e.target.value })}
                            placeholder="Project name (from Excel)"
                            className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2"
                          />
                          <input
                            type="text"
                            value={d.custom_site || ''}
                            onChange={e => updateDraft(d.tempId, { custom_site: e.target.value })}
                            placeholder="Project location"
                            className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2"
                          />
                          <button
                            type="button"
                            onClick={() => updateDraft(d.tempId, { custom_project_name: undefined, custom_site: undefined, custom_work_type: undefined, project_id: '' })}
                            className="text-xs px-2 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">
                            Use list
                          </button>
                        </div>
                      ) : (
                        <select value={d.project_id}
                          onChange={e => updateDraft(d.tempId, { project_id: e.target.value, worker_names: [] })}
                          className="w-full text-sm rounded-md border border-input bg-background px-3 py-2">
                          <option value="">Select project…</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name} — {p.site || 'No site'}</option>
                          ))}
                        </select>
                      )}
                    </div>


                    {/* Trip No (drives driver execution order) */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Trip No
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={drafts.length}
                        value={idx + 1}
                        onChange={e => setOrder(d.tempId, e.target.value)}
                        title="Lower Trip No runs first. Drivers follow this sequence."
                        className="w-full text-sm rounded-md border border-input bg-background px-3 py-2"
                      />
                    </div>
                  </div>

                  {/* Pickup location */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3" /> Pickup Point
                    </label>
                    {d.pickup_custom ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={d.pickup_location}
                          onChange={e => updateDraft(d.tempId, { pickup_location: e.target.value })}
                          placeholder="Type pickup location…"
                          className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2"
                        />
                        <button
                          onClick={() => updateDraft(d.tempId, { pickup_custom: false, pickup_location: DEFAULT_PICKUP })}
                          className="text-xs px-2 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          Use list
                        </button>
                      </div>
                    ) : (
                      <select
                        value={pickupOptions.includes(d.pickup_location) ? d.pickup_location : '__custom__'}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '__custom__') {
                            updateDraft(d.tempId, { pickup_custom: true, pickup_location: '' });
                          } else {
                            updateDraft(d.tempId, { pickup_location: v });
                          }
                        }}
                        className="w-full text-sm rounded-md border border-input bg-background px-3 py-2">
                        {pickupOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="__custom__">Custom…</option>
                      </select>
                    )}
                  </div>

                  {/* Workers */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Workers ({d.worker_names.length} selected{project ? ` • ${allWorkers.length} on project` : ''})
                    </label>

                    {/* Project worker quick-pick chips */}
                    {project && allWorkers.length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[40px]">
                          {allWorkers.map(name => {
                            const picked = d.worker_names.includes(name);
                            return (
                              <button key={name}
                                onClick={() => updateDraft(d.tempId, {
                                  worker_names: picked
                                    ? d.worker_names.filter(n => n !== name)
                                    : [...d.worker_names, name],
                                })}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  picked
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                }`}>
                                {name}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => updateDraft(d.tempId, { worker_names: Array.from(new Set([...d.worker_names, ...allWorkers])) })}
                            className="text-xs text-accent hover:underline">Select all project workers</button>
                          <button onClick={() => updateDraft(d.tempId, { worker_names: d.worker_names.filter(n => !allWorkers.includes(n)) })}
                            className="text-xs text-muted-foreground hover:underline">Clear project workers</button>
                        </div>
                      </>
                    )}

                    {/* Custom name input — visitors, subcontractors, swing labor */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={customNameInputs[d.tempId] || ''}
                        onChange={e => setCustomNameInputs(prev => ({ ...prev, [d.tempId]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); addCustomWorker(d.tempId); }
                        }}
                        placeholder="Add a name not on the project (e.g. visitor, subcontractor)…"
                        className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2"
                      />
                      <button
                        onClick={() => addCustomWorker(d.tempId)}
                        className="text-xs px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    </div>

                    {/* Selected list with removable chips + duplicate warnings */}
                    {d.worker_names.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Selected ({d.worker_names.length})</div>
                        <div className="flex flex-wrap gap-1.5">
                          {d.worker_names.map(name => {
                            const isDup = (workerOccurrences.get(name.trim().toUpperCase()) || 0) > 1;
                            const isCustom = !allWorkers.includes(name);
                            return (
                              <span key={name}
                                className={`inline-flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded-full border ${
                                  isDup
                                    ? 'border-warning bg-warning/10 text-warning-foreground'
                                    : isCustom
                                      ? 'border-accent bg-accent/10 text-accent-foreground'
                                      : 'border-border bg-muted text-foreground'
                                }`}>
                                {isDup && <AlertTriangle className="h-3 w-3 text-warning" />}
                                {name}
                                {isCustom && <span className="text-[10px] opacity-70">(custom)</span>}
                                <button
                                  onClick={() => removeWorker(d.tempId, name)}
                                  title="Remove"
                                  className="hover:bg-background/60 rounded-full p-0.5">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        {d.worker_names.some(n => (workerOccurrences.get(n.trim().toUpperCase()) || 0) > 1) && (
                          <div className="mt-1.5 text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Some workers also appear on other trips today — make sure they can split their day.
                          </div>
                        )}
                      </div>
                    )}

                    {d.worker_names.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        No workers selected — this trip will be treated as a solo visit. <strong>Notes field below is required.</strong>
                      </p>
                    )}
                  </div>

                  {/* Start time (End time is captured by the driver on trip completion) */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <Clock className="h-3 w-3" /> Start time
                    </label>
                    <input type="time" value={d.start_time}
                      onChange={e => updateDraft(d.tempId, { start_time: e.target.value })}
                      className="w-full text-sm rounded-md border border-input bg-background px-3 py-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      End time will be recorded automatically when the driver marks the trip complete.
                    </p>
                  </div>

                  {/* Vehicle + Driver */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                        <Truck className="h-3 w-3" /> Vehicle (optional)
                      </label>
                      <select value={d.vehicle_number}
                        onChange={e => onVehicleChange(d.tempId, e.target.value)}
                        className="w-full text-sm rounded-md border border-input bg-background px-3 py-2">
                        <option value="">— Let dispatcher decide —</option>
                        {d.vehicle_number && !vehicles.some(v => v.number === d.vehicle_number) && (
                          <option value={d.vehicle_number}>{d.vehicle_number} • (from Excel)</option>
                        )}
                        {vehicles.map(v => (
                          <option key={v.id} value={v.number}>
                            {v.number} • {v.type} • {v.capacity} seats
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                        <UserCog className="h-3 w-3" /> Driver (optional)
                      </label>
                      <input type="text" value={d.driver_name}
                        onChange={e => updateDraft(d.tempId, { driver_name: e.target.value })}
                        placeholder="Auto-fills from vehicle"
                        className="w-full text-sm rounded-md border border-input bg-background px-3 py-2" />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className={`text-xs font-medium block mb-1 ${d.worker_names.length === 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                      Notes {d.worker_names.length === 0 && <span className="font-semibold">— required (reason for solo trip)</span>}
                    </label>
                    <textarea value={d.notes}
                      onChange={e => updateDraft(d.tempId, { notes: e.target.value })}
                      rows={2}
                      placeholder={d.worker_names.length === 0
                        ? 'e.g. Site inspection, material drop, supervisor visit…'
                        : 'Special instructions for dispatcher…'}
                      className={`w-full text-sm rounded-md border bg-background px-3 py-2 resize-none ${
                        d.worker_names.length === 0 && !d.notes.trim() ? 'border-warning' : 'border-input'
                      }`} />
                  </div>

                  {project && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {project.site || 'No site'}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {allWorkers.length} workers on project</span>
                      <span>• {project.workType || project.type}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {drafts.length > 0 && (
            <div className="flex items-center justify-between sticky bottom-4 bg-background/95 backdrop-blur p-3 rounded-md border border-border shadow-sm">
              <button onClick={addDraft}
                className="text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Trip
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitted ? 'Update Submission' : `Submit ${drafts.length} Trip${drafts.length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
