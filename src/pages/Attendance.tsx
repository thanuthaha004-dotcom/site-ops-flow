import { useState, useMemo, useEffect } from 'react';
import { fetchWorkers } from '@/lib/supabaseData';
import { fetchDriverAttendance, type DriverAttendanceRecord } from '@/lib/driverData';
import type { Worker } from '@/data/mockData';
import { Clock, Download, LogIn, LogOut, Search, Truck, HardHat } from 'lucide-react';

interface AttendanceRecord {
  workerId: string;
  workerName: string;
  role: string;
  department: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
}

function generateMockAttendance(workerData: Worker[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const isSunday = date.getDay() === 0;
    workerData.forEach((w) => {
      if (isSunday) return;
      const isPresent = Math.random() > 0.15;
      if (!isPresent && dayOffset > 0) return;
      const checkInHour = 8 + Math.floor(Math.random() * 2);
      const checkInMin = Math.floor(Math.random() * 60);
      const checkOutHour = 17 + Math.floor(Math.random() * 4);
      const checkOutMin = Math.floor(Math.random() * 60);
      records.push({
        workerId: w.id, workerName: w.name, role: w.role, department: w.department, date: dateStr,
        checkIn: dayOffset === 0 && !isPresent ? null : `${String(checkInHour).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')}`,
        checkOut: dayOffset === 0 ? null : `${String(checkOutHour).padStart(2, '0')}:${String(checkOutMin).padStart(2, '0')}`,
      });
    });
  }
  return records;
}

function calcHours(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  return Math.max(0, (outH + outM / 60) - (inH + inM / 60));
}

function calcOvertime(hours: number, standardHours = 8): number {
  return Math.max(0, hours - standardHours);
}

export default function Attendance() {
  const [tab, setTab] = useState<'workers' | 'drivers'>('workers');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverAttendanceRecord[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchWorkers().then(data => {
      setRecords(generateMockAttendance(data));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'drivers') return;
    setLoadingDrivers(true);
    fetchDriverAttendance(7)
      .then(setDrivers)
      .catch(() => setDrivers([]))
      .finally(() => setLoadingDrivers(false));
  }, [tab]);

  const dates = useMemo(() => [...new Set(records.map(r => r.date))].sort(), [records]);

  const dayRecords = useMemo(() =>
    records.filter(r => r.date === selectedDate && r.workerName.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.workerName.localeCompare(b.workerName)),
    [records, selectedDate, search]
  );

  const overtimeSummary = useMemo(() => {
    const summary: Record<string, { name: string; role: string; department: string; totalHours: number; overtimeHours: number; daysWorked: number }> = {};
    records.forEach(r => {
      if (!summary[r.workerId]) summary[r.workerId] = { name: r.workerName, role: r.role, department: r.department, totalHours: 0, overtimeHours: 0, daysWorked: 0 };
      const hours = calcHours(r.checkIn, r.checkOut);
      if (hours > 0) { summary[r.workerId].totalHours += hours; summary[r.workerId].overtimeHours += calcOvertime(hours); summary[r.workerId].daysWorked += 1; }
    });
    return Object.entries(summary).map(([id, data]) => ({ workerId: id, ...data }));
  }, [records]);

  const downloadCSV = () => {
    const header = 'Worker ID,Name,Role,Department,Days Worked,Total Hours,Standard Hours,Overtime Hours\n';
    const rows = overtimeSummary.map(s => `${s.workerId},${s.name},${s.role},${s.department},${s.daysWorked},${s.totalHours.toFixed(1)},${(s.daysWorked * 8).toFixed(1)},${s.overtimeHours.toFixed(1)}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `overtime-sheet-${dates[0]}-to-${dates[dates.length - 1]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const todayPresent = dayRecords.filter(r => r.checkIn).length;
  const todayCheckedOut = dayRecords.filter(r => r.checkOut).length;

  // Driver attendance derived from trip_schedules
  const driverDates = useMemo(() => [...new Set(drivers.map(d => d.date))].sort().reverse(), [drivers]);
  const driverDayRecords = useMemo(
    () => drivers.filter(d => d.date === selectedDate && d.driverName.toLowerCase().includes(search.toLowerCase()))
                 .sort((a, b) => a.driverName.localeCompare(b.driverName)),
    [drivers, selectedDate, search]
  );
  const driverWeekly = useMemo(() => {
    const summary: Record<string, { name: string; vehicle: string; totalHours: number; overtimeHours: number; daysWorked: number; tripsCount: number }> = {};
    drivers.forEach(d => {
      if (!summary[d.driverName]) summary[d.driverName] = { name: d.driverName, vehicle: d.vehicleNumber, totalHours: 0, overtimeHours: 0, daysWorked: 0, tripsCount: 0 };
      if (d.hours > 0) {
        summary[d.driverName].totalHours += d.hours;
        summary[d.driverName].overtimeHours += d.overtime;
        summary[d.driverName].daysWorked += 1;
      }
      summary[d.driverName].tripsCount += d.tripsCount;
    });
    return Object.values(summary);
  }, [drivers]);

  const downloadDriverCSV = () => {
    const header = 'Driver,Vehicle,Days Worked,Trips,Total Hours,Standard Hours,Overtime Hours\n';
    const rows = driverWeekly.map(s => `${s.name},${s.vehicle},${s.daysWorked},${s.tripsCount},${s.totalHours.toFixed(1)},${(s.daysWorked * 8).toFixed(1)},${s.overtimeHours.toFixed(1)}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `driver-overtime-${driverDates[driverDates.length - 1] || 'today'}-to-${driverDates[0] || 'today'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground text-sm">
            {tab === 'workers'
              ? `${todayPresent} checked in • ${todayCheckedOut} checked out`
              : `${driverDayRecords.length} driver${driverDayRecords.length !== 1 ? 's' : ''} active on ${selectedDate}`}
          </p>
        </div>
        <button
          onClick={tab === 'workers' ? downloadCSV : downloadDriverCSV}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
          <Download className="h-4 w-4" /> Download Overtime Sheet
        </button>
      </div>

      {/* Tab switcher */}
      <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
        <button
          onClick={() => setTab('workers')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === 'workers' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <HardHat className="h-3.5 w-3.5" /> Workers
        </button>
        <button
          onClick={() => setTab('drivers')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === 'drivers' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <Truck className="h-3.5 w-3.5" /> Drivers <span className="text-[10px] text-muted-foreground">(live from trips)</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder={`Search ${tab}...`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(tab === 'workers' ? dates : driverDates).map(d => (
            <button key={d} onClick={() => setSelectedDate(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${selectedDate === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </button>
          ))}
        </div>
      </div>

      {tab === 'workers' && (
        <>
          <div className="kpi-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Worker</th><th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Check In</th><th className="pb-3 font-medium">Check Out</th>
                  <th className="pb-3 font-medium">Hours</th><th className="pb-3 font-medium">Overtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dayRecords.map((r) => {
                  const hours = calcHours(r.checkIn, r.checkOut);
                  const ot = calcOvertime(hours);
                  return (
                    <tr key={r.workerId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{r.workerName.split(' ').map(n => n[0]).join('')}</div><span className="font-medium">{r.workerName}</span></div></td>
                      <td className="py-3 text-muted-foreground">{r.role}</td>
                      <td className="py-3">{r.checkIn ? <span className="inline-flex items-center gap-1 text-success"><LogIn className="h-3 w-3" />{r.checkIn}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3">{r.checkOut ? <span className="inline-flex items-center gap-1 text-destructive"><LogOut className="h-3 w-3" />{r.checkOut}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 font-medium">{hours > 0 ? `${hours.toFixed(1)}h` : '—'}</td>
                      <td className="py-3">{ot > 0 ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning/10 text-warning text-xs font-semibold"><Clock className="h-3 w-3" />+{ot.toFixed(1)}h</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                    </tr>
                  );
                })}
                {dayRecords.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No records for this date</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Weekly Overtime Summary</h2>
              <span className="text-xs text-muted-foreground">{dates[0]} to {dates[dates.length - 1]}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Worker</th><th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium">Days</th><th className="pb-3 font-medium">Total Hrs</th>
                    <th className="pb-3 font-medium">Standard Hrs</th><th className="pb-3 font-medium">OT Hrs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overtimeSummary.sort((a, b) => b.overtimeHours - a.overtimeHours).map((s) => (
                    <tr key={s.workerId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-medium">{s.name}</td>
                      <td className="py-2.5 text-muted-foreground">{s.department}</td>
                      <td className="py-2.5">{s.daysWorked}</td>
                      <td className="py-2.5">{s.totalHours.toFixed(1)}</td>
                      <td className="py-2.5">{(s.daysWorked * 8).toFixed(1)}</td>
                      <td className="py-2.5">{s.overtimeHours > 0 ? <span className="text-warning font-semibold">+{s.overtimeHours.toFixed(1)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'drivers' && (
        <>
          <div className="kpi-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Driver</th><th className="pb-3 font-medium">Vehicle</th>
                  <th className="pb-3 font-medium">Check In</th><th className="pb-3 font-medium">Check Out</th>
                  <th className="pb-3 font-medium">Trips</th><th className="pb-3 font-medium">Hours</th><th className="pb-3 font-medium">Overtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingDrivers && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading driver attendance…</td></tr>}
                {!loadingDrivers && driverDayRecords.map((d) => (
                  <tr key={d.driverName + d.date} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs">{d.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div><span className="font-medium">{d.driverName}</span></div></td>
                    <td className="py-3 text-muted-foreground">{d.vehicleNumber}</td>
                    <td className="py-3">{d.checkIn ? <span className="inline-flex items-center gap-1 text-success"><LogIn className="h-3 w-3" />{d.checkIn}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-3">{d.checkOut ? <span className="inline-flex items-center gap-1 text-destructive"><LogOut className="h-3 w-3" />{d.checkOut}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-3">{d.tripsCount}</td>
                    <td className="py-3 font-medium">{d.hours > 0 ? `${d.hours.toFixed(1)}h` : '—'}</td>
                    <td className="py-3">{d.overtime > 0 ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning/10 text-warning text-xs font-semibold"><Clock className="h-3 w-3" />+{d.overtime.toFixed(1)}h</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                  </tr>
                ))}
                {!loadingDrivers && driverDayRecords.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No driver activity for this date. Drivers appear once they start a trip.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Driver Weekly Summary</h2>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Driver</th><th className="pb-3 font-medium">Vehicle</th>
                    <th className="pb-3 font-medium">Days</th><th className="pb-3 font-medium">Trips</th>
                    <th className="pb-3 font-medium">Total Hrs</th><th className="pb-3 font-medium">Standard Hrs</th><th className="pb-3 font-medium">OT Hrs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {driverWeekly.sort((a, b) => b.overtimeHours - a.overtimeHours).map((s) => (
                    <tr key={s.name} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-medium">{s.name}</td>
                      <td className="py-2.5 text-muted-foreground">{s.vehicle}</td>
                      <td className="py-2.5">{s.daysWorked}</td>
                      <td className="py-2.5">{s.tripsCount}</td>
                      <td className="py-2.5">{s.totalHours.toFixed(1)}</td>
                      <td className="py-2.5">{(s.daysWorked * 8).toFixed(1)}</td>
                      <td className="py-2.5">{s.overtimeHours > 0 ? <span className="text-warning font-semibold">+{s.overtimeHours.toFixed(1)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    </tr>
                  ))}
                  {driverWeekly.length === 0 && !loadingDrivers && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No driver activity in the last 7 days.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
