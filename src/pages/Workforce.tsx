import { useState, useEffect } from 'react';
import { fetchWorkers, insertWorker, deleteWorkerDb, updateWorkerDb } from '@/lib/supabaseData';
import type { Worker } from '@/data/mockData';
import { Search, Phone, MapPin, Trash2, Edit3 } from 'lucide-react';
import AddWorkerDialog from '@/components/forms/AddWorkerDialog';
import EditWorkerDialog from '@/components/forms/EditWorkerDialog';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { parseWorkersExcel } from '@/lib/excelImport';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function Workforce() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [workerList, setWorkerList] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);

  const loadWorkers = async () => {
    try {
      const data = await fetchWorkers();
      setWorkerList(data);
    } catch { toast({ title: 'Failed to load workers', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadWorkers(); }, []);

  const departments = ['All', ...Array.from(new Set(workerList.map(w => w.department).filter(Boolean)))];
  const filtered = workerList.filter(w =>
    (deptFilter === 'All' || w.department === deptFilter) &&
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const onSite = workerList.filter(w => w.status === 'On Site').length;
  const available = workerList.filter(w => w.status === 'Available').length;

  const handleAdd = async (worker: Omit<Worker, 'id'>) => {
    try {
      const created = await insertWorker(worker);
      setWorkerList(prev => [created, ...prev]);
      toast({ title: 'Worker added' });
    } catch { toast({ title: 'Failed to add worker', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkerDb(id);
      setWorkerList(prev => prev.filter(w => w.id !== id));
      toast({ title: 'Worker deleted' });
    } catch { toast({ title: 'Failed to delete worker', variant: 'destructive' }); }
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await parseWorkersExcel(file);
      for (const w of imported) {
        const created = await insertWorker(w);
        setWorkerList(prev => [created, ...prev]);
      }
      toast({ title: `Imported ${imported.length} workers` });
    } catch { toast({ title: 'Failed to parse file', variant: 'destructive' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading workers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workforce</h1>
          <p className="text-muted-foreground text-sm">{workerList.length} workers • {onSite} on site • {available} available</p>
        </div>
        <div className="flex gap-2">
          <ExcelUploadButton label="Import Excel" onFileSelect={handleImport} />
          <AddWorkerDialog onAdd={handleAdd}>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
              + Add Worker
            </button>
          </AddWorkerDialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search workers..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                deptFilter === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}>{d}</button>
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
                  <p className="text-xs text-muted-foreground">{w.staffCode && <span className="font-mono">{w.staffCode} • </span>}{w.role} • {w.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  w.status === 'On Site' ? 'status-active' : w.status === 'Available' ? 'bg-info/10 text-info' : 'status-idle'
                }`}>{w.status}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {w.name}?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently remove this worker.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(w.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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
      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">No workers found. Add your first worker above.</div>
      )}
    </div>
  );
}
