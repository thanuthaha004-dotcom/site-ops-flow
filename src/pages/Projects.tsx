import { useState, useEffect } from 'react';
import { fetchProjects, insertProject, updateProject, deleteProjectDb } from '@/lib/supabaseData';
import type { Project, ProjectType, ProjectStatus, Priority } from '@/data/mockData';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/ProjectStatusBadge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Users, Calendar, Search, Download, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import { getAreaCluster } from '@/lib/tripPlanning';

const KNOWN_ZONES = new Set([
  'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4',
  'Hub - Al Quoz Camp', 'Sharjah', 'Ajman', 'Al Ain', 'Abu Dhabi',
]);

const ZONE_STYLES: Record<string, string> = {
  'Zone 1': 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'Zone 2': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'Zone 3': 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'Zone 4': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'Hub - Al Quoz Camp': 'bg-primary/15 text-primary border-primary/30',
  'Sharjah': 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  'Ajman': 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  'Al Ain': 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  'Abu Dhabi': 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
};

function ZoneBadge({ site }: { site: string }) {
  if (!site) return null;
  const zone = getAreaCluster(site);
  const matched = KNOWN_ZONES.has(zone);
  if (matched) {
    const label = zone === 'Hub - Al Quoz Camp' ? 'Hub' : zone;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${ZONE_STYLES[zone]}`} title={zone}>
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" title="No zone matched ≥70% similarity. Review site name.">
      <AlertTriangle className="h-2.5 w-2.5" /> Unzoned
    </span>
  );
}
import AddProjectDialog from '@/components/forms/AddProjectDialog';
import EditProjectDialog from '@/components/forms/EditProjectDialog';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { parseProjectsExcel } from '@/lib/excelImport';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';

const projectTypes: ('All' | ProjectType)[] = ['All', 'LPG', 'Fire Fighting', 'Small Job', 'AMC Gas', 'AMC Fire'];

export default function Projects() {
  const [typeFilter, setTypeFilter] = useState<'All' | ProjectType>('All');
  const [search, setSearch] = useState('');
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjectList(data);
    } catch { toast({ title: 'Failed to load projects', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProjects(); }, []);

  const filtered = projectList.filter(p =>
    (typeFilter === 'All' || p.type === typeFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (project: Omit<Project, 'id'>) => {
    try {
      const created = await insertProject(project);
      setProjectList(prev => [created, ...prev]);
      toast({ title: 'Project added' });
    } catch { toast({ title: 'Failed to add project', variant: 'destructive' }); }
  };

  const handleUpdate = async (id: string, updates: Partial<Project>) => {
    try {
      const updated = await updateProject(id, updates);
      setProjectList(prev => prev.map(p => p.id === id ? updated : p));
      toast({ title: 'Project updated' });
    } catch { toast({ title: 'Failed to update project', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProjectDb(id);
      setProjectList(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Project deleted' });
    } catch { toast({ title: 'Failed to delete project', variant: 'destructive' }); }
  };

  const handleExport = () => {
    const data = projectList.map(p => ({
      Code: p.code, Name: p.name, Type: p.type, Site: p.site, Status: p.status,
      Priority: p.priority, 'Start Date': p.startDate, 'End Date': p.endDate,
      Engineer: p.engineer, 'Workers Required': p.workersRequired,
      'Workers Assigned': p.workersAssigned, Progress: p.progress,
      'Work Type': p.workType || '',
      'Worker Names': (p.workerNames || []).join(', '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, 'Projects.xlsx');
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await parseProjectsExcel(file);
      for (const p of imported) {
        const created = await insertProject(p);
        setProjectList(prev => [created, ...prev]);
      }
      toast({ title: `Imported ${imported.length} projects` });
    } catch { toast({ title: 'Failed to parse file', variant: 'destructive' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading projects...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">{projectList.length} total projects</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors">
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <ExcelUploadButton label="Import Excel" onFileSelect={handleImport} />
          <AddProjectDialog onAdd={handleAdd}>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
              + New Project
            </button>
          </AddProjectDialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {projectTypes.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="kpi-card flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{p.code}</p>
                <h3 className="font-semibold mt-0.5">{p.name}</h3>
              </div>
              <div className="flex items-center gap-1">
                <PriorityBadge priority={p.priority} />
                <EditProjectDialog project={p} onSave={(updates) => handleUpdate(p.id, updates)}>
                  <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </EditProjectDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently remove this project.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.site}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground">{p.type}</span>
              {p.workType && <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">{p.workType}</span>}
              <StatusBadge status={p.status} />
            </div>

            <div className="flex items-center gap-2">
              <Progress value={p.progress} className="h-2 flex-1" />
              <span className="text-xs font-medium">{p.progress}%</span>
            </div>

            {p.workerNames && p.workerNames.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Workers:</span> {p.workerNames.join(', ')}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.workersAssigned}/{p.workersRequired} workers</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{p.endDate}</span>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">No projects found. Add your first project above.</div>
      )}
    </div>
  );
}
