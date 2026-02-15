import { useState } from 'react';
import { workers } from '@/data/mockData';
import { Search, Phone, MapPin } from 'lucide-react';

export default function Workforce() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  const departments = ['All', ...Array.from(new Set(workers.map(w => w.department)))];
  const filtered = workers.filter(w =>
    (deptFilter === 'All' || w.department === deptFilter) &&
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const onSite = workers.filter(w => w.status === 'On Site').length;
  const available = workers.filter(w => w.status === 'Available').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workforce</h1>
        <p className="text-muted-foreground text-sm">{workers.length} workers • {onSite} on site • {available} available</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search workers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {departments.map(d => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                deptFilter === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Worker Cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((w) => (
          <div key={w.id} className="kpi-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {w.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-semibold">{w.name}</h3>
                  <p className="text-xs text-muted-foreground">{w.role} • {w.department}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                w.status === 'On Site' ? 'status-active' : w.status === 'Available' ? 'bg-info/10 text-info' : 'status-idle'
              }`}>
                {w.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-1">
                {w.skills.map(s => (
                  <span key={s} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{s}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{w.currentSite}</span>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{w.phone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
