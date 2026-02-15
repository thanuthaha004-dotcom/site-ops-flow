import KPICard from '@/components/dashboard/KPICard';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/ProjectStatusBadge';
import { kpis, projects, vehicles, utilizationData } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Truck, AlertTriangle, MapPin } from 'lucide-react';

export default function Dashboard() {
  const activeProjects = projects.filter(p => p.status === 'Active');
  const activeVehicles = vehicles.filter(v => v.status === 'Active');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Operations overview for today</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Utilization Chart */}
        <div className="lg:col-span-2 kpi-card">
          <h2 className="font-semibold mb-4">Utilization Trends</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar dataKey="vehicles" name="Vehicles %" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="workers" name="Workers %" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Vehicles */}
        <div className="kpi-card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-accent" /> Fleet Status
          </h2>
          <div className="space-y-3">
            {vehicles.slice(0, 4).map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{v.number}</p>
                  <p className="text-xs text-muted-foreground">{v.driver}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    v.status === 'Active' ? 'status-active' : v.status === 'Maintenance' ? 'status-warning' : 'status-idle'
                  }`}>
                    {v.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.utilization}% util.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Projects Table */}
      <div className="kpi-card overflow-x-auto">
        <h2 className="font-semibold mb-4">Active Projects</h2>
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
                <td className="py-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground sm:hidden">{p.type}</p>
                </td>
                <td className="py-3 hidden sm:table-cell">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">{p.type}</span>
                </td>
                <td className="py-3 hidden md:table-cell">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />{p.site}
                  </span>
                </td>
                <td className="py-3"><StatusBadge status={p.status} /></td>
                <td className="py-3 w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={p.progress} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-8">{p.progress}%</span>
                  </div>
                </td>
                <td className="py-3 hidden lg:table-cell"><PriorityBadge priority={p.priority} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alerts */}
      <div className="kpi-card border-warning/30">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" /> Alerts
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 p-2 rounded bg-warning/5">
            <span className="h-2 w-2 rounded-full bg-warning mt-1.5 flex-shrink-0" />
            <p><strong>PRJ-001:</strong> 2 workers short — Ambuja Tower LPG needs 2 more pipe fitters</p>
          </div>
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/5">
            <span className="h-2 w-2 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
            <p><strong>VH-004:</strong> Low fuel alert — Heavy Truck at 30% fuel</p>
          </div>
          <div className="flex items-start gap-2 p-2 rounded bg-warning/5">
            <span className="h-2 w-2 rounded-full bg-warning mt-1.5 flex-shrink-0" />
            <p><strong>VH-005:</strong> Vehicle in maintenance since Feb 10 — expected back Feb 17</p>
          </div>
        </div>
      </div>
    </div>
  );
}
