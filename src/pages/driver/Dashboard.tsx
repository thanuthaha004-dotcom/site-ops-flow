import { useEffect, useMemo, useState } from 'react';
import { Loader2, Calendar, CheckCircle2, Clock, Truck, Timer, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchDriverTrips, tripActiveSeconds, formatDuration, type DriverTrip } from '@/lib/driverData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TripCard from '@/components/driver/TripCard';
import DaySelector from '@/components/driver/DaySelector';

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLongDate(key: string): string {
  const d = new Date(key + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function DriverDashboard() {
  const { profileName } = useAuth();
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dateKey(new Date()));

  useEffect(() => {
    fetchDriverTrips()
      .then(setTrips)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const tripsByDate = useMemo(() => {
    return trips.reduce<Record<string, DriverTrip[]>>((acc, t) => {
      (acc[t.trip_date] ||= []).push(t);
      return acc;
    }, {});
  }, [trips]);

  const todayKey = dateKey(new Date());
  const todaysTrips = tripsByDate[todayKey] || [];
  const completedToday = todaysTrips.filter(t => t.status === 'completed');
  const pendingToday = todaysTrips.filter(t => t.status !== 'completed');
  const totalSecondsToday = todaysTrips.reduce((sum, t) => sum + tripActiveSeconds(t), 0);

  const selectedTrips = (tripsByDate[selectedDate] || []).slice().sort((a, b) =>
    a.time_slot.localeCompare(b.time_slot)
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Greeting */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Hello{profileName ? `, ${profileName.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            <CheckCircle2 className="h-4 w-4 text-success" /> Completed
          </div>
          <p className="text-3xl font-bold mt-1">{completedToday.length}</p>
          <p className="text-xs text-muted-foreground mt-1">trips today</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            <Clock className="h-4 w-4 text-accent" /> Pending
          </div>
          <p className="text-3xl font-bold mt-1">{pendingToday.length}</p>
          <p className="text-xs text-muted-foreground mt-1">trips today</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            <Truck className="h-4 w-4 text-primary" /> Total
          </div>
          <p className="text-3xl font-bold mt-1">{todaysTrips.length}</p>
          <p className="text-xs text-muted-foreground mt-1">trips today</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            <Timer className="h-4 w-4 text-warning" /> Drive time
          </div>
          <p className="text-3xl font-bold mt-1">{formatDuration(totalSecondsToday) || '0s'}</p>
          <p className="text-xs text-muted-foreground mt-1">active today</p>
        </div>
      </section>

      {/* Today's tasks */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Today's Tasks
        </h2>
        {todaysTrips.length === 0 ? (
          <div className="kpi-card text-center py-8">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No trips scheduled for today.</p>
          </div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-xs">
              <TabsTrigger value="pending">Pending ({pendingToday.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedToday.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="space-y-2 mt-3">
              {pendingToday.length === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">All caught up — nothing pending! ✅</p>
                : pendingToday.map(t => <TripCard key={t.id} trip={t} />)}
            </TabsContent>
            <TabsContent value="completed" className="space-y-2 mt-3">
              {completedToday.length === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">No trips completed yet today.</p>
                : completedToday.map(t => <TripCard key={t.id} trip={t} />)}
            </TabsContent>
          </Tabs>
        )}
      </section>

      {/* 7-Day strip */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Calendar className="h-4 w-4" /> 7-Day Schedule
        </h2>
        <DaySelector
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          tripsByDate={tripsByDate}
        />
      </section>

      {/* Selected day's trips */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="text-foreground">{formatLongDate(selectedDate)}</span>
          <span className="text-xs text-muted-foreground font-normal">
            · {selectedTrips.length} trip{selectedTrips.length !== 1 ? 's' : ''}
          </span>
        </h2>
        {selectedTrips.length === 0 ? (
          <div className="kpi-card text-center py-8">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No trips on this day.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedTrips.map(t => <TripCard key={t.id} trip={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}
