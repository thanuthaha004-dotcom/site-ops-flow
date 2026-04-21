import { CheckCircle2 } from 'lucide-react';
import type { DriverTrip } from '@/lib/driverData';

interface DaySelectorProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  tripsByDate: Record<string, DriverTrip[]>;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DaySelector({ selectedDate, onSelect, tripsByDate }: DaySelectorProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);

  // 3 before, today, 3 after
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() + (i - 3) * 86400000);
    return d;
  });

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map(d => {
        const key = dateKey(d);
        const trips = tripsByDate[key] || [];
        const total = trips.length;
        const completed = trips.filter(t => t.status === 'completed').length;
        const allDone = total > 0 && completed === total;
        const partial = completed > 0 && completed < total;
        const isSelected = key === selectedDate;
        const isToday = key === todayKey;
        const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
        const dayNum = d.getDate();

        let dotClass = 'bg-muted';
        if (allDone) dotClass = 'bg-success';
        else if (partial) dotClass = 'bg-warning';
        else if (total > 0) dotClass = 'bg-accent';

        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all
              ${isSelected
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : 'bg-card border-border hover:border-accent'}
            `}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {weekday}
            </span>
            <span className={`text-lg font-bold leading-tight ${isToday && !isSelected ? 'text-accent' : ''}`}>
              {dayNum}
            </span>
            <div className="flex items-center gap-1 mt-1 h-3">
              {total > 0 && (
                <>
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                    {total}
                  </span>
                  {allDone && <CheckCircle2 className={`h-3 w-3 ${isSelected ? 'text-primary-foreground' : 'text-success'}`} />}
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
