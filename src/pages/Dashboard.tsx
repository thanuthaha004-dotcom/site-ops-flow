import { useState, useEffect } from 'react';
import KPICard from '@/components/dashboard/KPICard';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/ProjectStatusBadge';
import { utilizationData } from '@/data/mockData';
import type { Project, Vehicle, KPI } from '@/data/mockData';
import { fetchProjects, fetchVehicles } from '@/lib/supabaseData';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Truck, AlertTriangle, MapPin } from 'lucide-react';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => {});
    fetchVehicles().then(setVehicles).catch(() => {});
  }, []);

  const activeProjects = projects.filter(p => p.status === 'Active');
  const avgUtil = vehicles.length ? Math.round(vehicles.reduce((a, v) => a + v.utilization, 0) / vehicles.length) : 0;

  const kpis: KPI[] = [
    { label: 'Active Projects', value: String(activeProjects.length), change: 0, trend: 'neutral' },
    { label: 'Vehicle Utilization', value: `${avgUtil}%`, change: 0, trend: 'neutral' },
    { label: 'Total Vehicles', value: String(vehicles.length), change: 0, trend: 'neutral' },
    { label: 'Total Projects', value: String(projects.length), change: 0, trend: 'neutral' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Operations overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 kpi-card">
          <h2 className="font-semibold mb-4">Utilization Trends</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Legend />
                <Bar dataKey="vehicles" name="Vehicles %" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="workers" name="Workers %" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="kpi-card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-accent" /> Fleet Status
          </h2>
          <div className="space-y-3">
            {vehicles.slice(0, 4).map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div><p className="text-sm font-medium">{v.number}</p><p className="text-xs text-muted-foreground">{v.driver}</p></div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    v.status === 'Active' ? 'status-active' : v.status === 'Maintenance' ? 'status-warning' : 'status-idle'
                  }`}>{v.status}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.utilization}% util.</p>
                </div>
              </div>
            ))}
            {vehicles.length === 0 && <p className="text-sm text-muted-foreground">No vehicles added yet</p>}
          </div>
        </div>
      </div>

      <div className="kpi-card overflow-x-auto">
        <h2 className="font-semibold mb-4">Projects</h2>
        {projects.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-muted-foreground">Project</th>
                <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Site</th>
                <th className="pb-3 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 font-medium text-muted-foreground">Progress</th>
                <th className="pb-3 font-medium text-muted-foreground hidden lg:table-cell">Priority</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground sm:hidden">{p.type}</p></td>
                  <td className="py-3 hidden sm:table-cell"><span className="text-xs bg-secondary px-2 py-1 rounded">{p.type}</span></td>
                  <td className="py-3 hidden md:table-cell"><span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{p.site}</span></td>
                  <td className="py-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 w-32"><div className="flex items-center gap-2"><Progress value={p.progress} className="h-2 flex-1" /><span className="text-xs text-muted-foreground w-8">{p.progress}%</span></div></td>
                  <td className="py-3 hidden lg:table-cell"><PriorityBadge priority={p.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No projects added yet</p>
        )}
      </div>
    </div>
  );
}
