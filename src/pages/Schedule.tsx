import { useState, useEffect } from 'react';
import { fetchProjects } from '@/lib/supabaseData';
import type { Project } from '@/data/mockData';
import { StatusBadge } from '@/components/dashboard/ProjectStatusBadge';
import { Clock, MapPin, Users } from 'lucide-react';

const columns = [
  { key: 'Active', label: 'In Progress', color: 'bg-success' },
  { key: 'Scheduled', label: 'Scheduled', color: 'bg-info' },
  { key: 'On Hold', label: 'On Hold', color: 'bg-warning' },
  { key: 'Completed', label: 'Completed', color: 'bg-muted-foreground' },
] as const;

export default function Schedule() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => { fetchProjects().then(setProjects).catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule Board</h1>
          <p className="text-muted-foreground text-sm">Project scheduling overview</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const items = projects.filter(p => p.status === col.key);
          return (
            <div key={col.key} className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <span className="ml-auto bg-background text-xs font-medium px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <div key={p.id} className="bg-card rounded-md border p-3 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                    <h4 className="font-medium text-sm mt-0.5 mb-2">{p.name}</h4>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.site.split(',')[0]}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.workersAssigned}</span>
                    </div>
                    <div className="mt-2">
                      <span className="bg-secondary px-2 py-0.5 rounded text-xs text-secondary-foreground">{p.type}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border rounded-md">No projects</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
