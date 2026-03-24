import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Worker, WorkerStatus } from '@/data/mockData';

interface Props {
  onAdd: (worker: Omit<Worker, 'id'>) => void;
  children: React.ReactNode;
}

export default function AddWorkerDialog({ onAdd, children }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    staffCode: '', name: '', role: '', department: '', skills: '',
    status: 'Available' as WorkerStatus, currentSite: '—', phone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...form,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
    });
    setOpen(false);
    setForm({ staffCode: '', name: '', role: '', department: '', skills: '', status: 'Available', currentSite: '—', phone: '' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add New Worker</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Anil Thorat" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Input required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Technician" />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select value={form.department || 'LPG'} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['LPG', 'Fire Fighting', 'Small Jobs', 'AMC Gas', 'AMC Fire'].map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Skills (comma separated)</Label>
            <Input value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="e.g. Welding, Pipe Fitting" />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </div>
          <button type="submit" className="w-full py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            Add Worker
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
