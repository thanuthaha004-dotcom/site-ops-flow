import { useState, useEffect } from 'react';
import { fetchProjects } from '@/lib/supabaseData';
import type { Project } from '@/data/mockData';
import { StatusBadge } from '@/components/dashboard/ProjectStatusBadge';
import { Clock, MapPin, Users, CalendarIcon } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const columns = [
  { key: 'Active', label: 'In Progress', color: 'bg-success' },
  { key: 'Scheduled', label: 'Scheduled', color: 'bg-info' },
  { key: 'On Hold', label: 'On Hold', color: 'bg-warning' },
  { key: 'Completed', label: 'Completed', color: 'bg-muted-foreground' },
] as const;

export default function Schedule() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => { fetchProjects().then(setProjects).catch(() => {}); }, []);

  const handleDateChange = (date: Date | undefined) => {
    if (date) setSelectedDate(date);
  };

  // Filter projects relevant to the selected date
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const filteredProjects = projects.filter(p => {
    if (!p.startDate && !p.endDate) return true;
    if (p.startDate && dateStr < p.startDate) return false;
    if (p.endDate && dateStr > p.endDate) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule Board</h1>
          <p className="text-muted-foreground text-sm">Project scheduling for {format(selectedDate, 'EEEE, MMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80">←</button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'MMM d, yyyy')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
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
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const items = filteredProjects.filter(p => p.status === col.key);
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{p.code}</p>
                      {p.startDate && p.endDate && (
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(p.startDate), 'MMM d')} – {format(new Date(p.endDate), 'MMM d')}
                        </p>
                      )}
                    </div>
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