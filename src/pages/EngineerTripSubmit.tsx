import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjects } from '@/lib/supabaseData';
import { fetchMyTripRequests, submitTripRequests } from '@/lib/tripRequestsData';
import type { Project } from '@/data/mockData';
import { format, subDays, addDays } from 'date-fns';
import { CalendarIcon, CheckCircle2, FolderKanban, MapPin, Users, Send, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function EngineerTripSubmit() {
  const { user, profileName } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [existingRequests, setExistingRequests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch projects assigned to this engineer
  useEffect(() => {
    fetchProjects().then(all => {
      const me = (profileName || '').trim().toLowerCase();
      const mine = all.filter(p =>
        (p.status === 'Active' || p.status === 'Scheduled') &&
        (p.engineer || '').trim().toLowerCase() === me &&
        (p.workerNames || []).length > 0
      );
      setProjects(mine);
    }).catch(() => {});
  }, [profileName]);

  // Check existing submissions for this date
  const checkExisting = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const existing = await fetchMyTripRequests(dateStr, user.id);
      setExistingRequests(existing.map(r => r.project_id));
      setSelectedProjectIds(new Set(existing.map(r => r.project_id)));
      setSubmitted(existing.length > 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateStr, user]);

  useEffect(() => { checkExisting(); }, [checkExisting]);

  const toggleProject = (id: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!user || selectedProjectIds.size === 0) return;
    setSubmitting(true);
    try {
      const selected = projects.filter(p => selectedProjectIds.has(p.id));
      await submitTripRequests(
        dateStr,
        user.id,
        profileName || user.email || '',
        selected.map(p => ({
          project_id: p.id,
          project_name: p.name,
          site: p.site,
          worker_names: p.workerNames || [],
          work_type: p.workType || '',
          priority: p.priority,
        }))
      );
      setSubmitted(true);
      setExistingRequests(selected.map(p => p.id));
      toast({ title: `Submitted ${selected.length} project requests for ${format(selectedDate, 'MMM d, yyyy')}` });
    } catch {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const totalWorkers = projects.filter(p => selectedProjectIds.has(p.id)).reduce((sum, p) => sum + (p.workerNames || []).length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Submit Trip Requests</h1>
        <p className="text-muted-foreground text-sm">Select projects that need worker trips for the chosen date</p>
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
          <h2 className="text-lg font-semibold">No Projects Assigned</h2>
          <p className="text-sm text-muted-foreground mt-1">You don't have any active projects with workers assigned to you.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedProjectIds.size} of {projects.length} projects selected • {totalWorkers} workers
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedProjectIds(new Set(projects.map(p => p.id)))}
                className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">Select All</button>
              <button onClick={() => { setSelectedProjectIds(new Set()); setSubmitted(false); }}
                className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">Deselect All</button>
            </div>
          </div>

          <div className="space-y-2">
            {projects.map(p => (
              <label key={p.id}
                className={`flex items-start gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                  selectedProjectIds.has(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                }`}>
                <input type="checkbox" checked={selectedProjectIds.has(p.id)} onChange={() => toggleProject(p.id)}
                  className="rounded border-input mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{p.code}</span>
                    {p.priority === 'High' && <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">High Priority</span>}
                    <span className="text-xs bg-accent/10 text-accent-foreground px-1.5 py-0.5 rounded">{p.workType || p.type}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.site || 'No site'}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {(p.workerNames || []).length} workers</span>
                  </div>
                  {(p.workerNames || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(p.workerNames || []).map((n, i) => (
                        <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={handleSubmit} disabled={submitting || selectedProjectIds.size === 0}
              className="px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitted ? 'Update Submission' : 'Submit Trip Requests'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
