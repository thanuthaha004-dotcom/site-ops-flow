import { useState } from 'react';
import { getProjects, addProject, saveProjects } from '@/lib/localStorage';
import type { Project, ProjectType } from '@/data/mockData';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/ProjectStatusBadge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Users, Calendar, Search, Download } from 'lucide-react';
import AddProjectDialog from '@/components/forms/AddProjectDialog';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { parseProjectsExcel } from '@/lib/excelImport';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const projectTypes: ('All' | ProjectType)[] = ['All', 'LPG', 'Fire Fighting', 'Small Job', 'AMC'];

export default function Projects() {
  const [typeFilter, setTypeFilter] = useState<'All' | ProjectType>('All');
  const [search, setSearch] = useState('');
  const [projectList, setProjectList] = useState<Project[]>(getProjects);

  const filtered = projectList.filter(p =>
    (typeFilter === 'All' || p.type === typeFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (project: Project) => {
    const updated = addProject(project);
    setProjectList(updated);
  };

  const handleExport = () => {
    const data = projectList.map(p => ({
      ID: p.id, Name: p.name, Type: p.type, Site: p.site, Status: p.status,
      Priority: p.priority, 'Start Date': p.startDate, 'End Date': p.endDate,
      Engineer: p.engineer, 'Workers Required': p.workersRequired,
      'Workers Assigned': p.workersAssigned, Progress: p.progress,
      'Worker Names': (p.workerNames || []).join(', '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, 'Projects.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">{projectList.length} total projects</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors">
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <ExcelUploadButton label="Import Excel" onFileSelect={async (file) => {
            try {
              const imported = await parseProjectsExcel(file);
              const merged = [...projectList, ...imported];
              saveProjects(merged);
              setProjectList(merged);
              toast({ title: `Imported ${imported.length} projects` });
            } catch { toast({ title: 'Failed to parse file', variant: 'destructive' }); }
          }} />
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
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {projectTypes.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="kpi-card flex flex-col gap-3 cursor-pointer hover:border-accent/40 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{p.id}</p>
                <h3 className="font-semibold mt-0.5">{p.name}</h3>
              </div>
              <PriorityBadge priority={p.priority} />
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.site}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground">{p.type}</span>
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
    </div>
  );
}
