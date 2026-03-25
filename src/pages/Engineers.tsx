import { useState, useEffect } from 'react';
import { fetchEngineers, insertEngineer, updateEngineerDb, deleteEngineerDb } from '@/lib/supabaseData';
import type { Engineer } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit3, Search, UserCog } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function EngineerFormDialog({ engineer, onSave, children }: {
  engineer?: Engineer;
  onSave: (data: Omit<Engineer, 'id'>) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', phone: '' });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && engineer) setForm({ name: engineer.name, department: engineer.department, phone: engineer.phone });
    else if (isOpen) setForm({ name: '', department: '', phone: '' });
    setOpen(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{engineer ? 'Edit Engineer' : 'Add Engineer'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Engineer name" />
          </div>
          <div className="space-y-2">
            <Label>Department *</Label>
            <Input required value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. LPG, Fire Fighting" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
          </div>
          <button type="submit" className="w-full py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            {engineer ? 'Save Changes' : 'Add Engineer'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Engineers() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setEngineers(await fetchEngineers()); }
    catch { toast({ title: 'Failed to load engineers', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = engineers.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (data: Omit<Engineer, 'id'>) => {
    try {
      const created = await insertEngineer(data);
      setEngineers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      toast({ title: 'Engineer added' });
    } catch { toast({ title: 'Failed to add engineer', variant: 'destructive' }); }
  };

  const handleUpdate = async (id: string, data: Omit<Engineer, 'id'>) => {
    try {
      const updated = await updateEngineerDb(id, data);
      setEngineers(prev => prev.map(e => e.id === id ? updated : e));
      toast({ title: 'Engineer updated' });
    } catch { toast({ title: 'Failed to update', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEngineerDb(id);
      setEngineers(prev => prev.filter(e => e.id !== id));
      toast({ title: 'Engineer deleted' });
    } catch { toast({ title: 'Failed to delete', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engineers</h1>
          <p className="text-muted-foreground text-sm">Master data for project engineers</p>
        </div>
        <EngineerFormDialog onSave={handleAdd}>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
            <Plus size={16} /> Add Engineer
          </button>
        </EngineerFormDialog>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Search engineers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserCog size={48} className="mx-auto mb-3 opacity-40" />
          <p>No engineers found. Add your first engineer above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(eng => (
            <div key={eng.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{eng.name}</h3>
                  <p className="text-xs text-muted-foreground">{eng.department || '—'}</p>
                </div>
                <div className="flex gap-1">
                  <EngineerFormDialog engineer={eng} onSave={(data) => handleUpdate(eng.id, data)}>
                    <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
                      <Edit3 size={14} />
                    </button>
                  </EngineerFormDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {eng.name}?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(eng.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {eng.phone && <p className="text-xs text-muted-foreground">📞 {eng.phone}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
