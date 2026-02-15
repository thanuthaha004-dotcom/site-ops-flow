import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPI } from '@/data/mockData';

export default function KPICard({ label, value, change, trend }: KPI) {
  return (
    <div className="kpi-card">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <div className="flex items-center gap-1 mt-2">
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-success" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-destructive" />}
        {trend === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground" />}
        <span className={`text-xs font-medium ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {change > 0 ? '+' : ''}{change}% vs last week
        </span>
      </div>
    </div>
  );
}
