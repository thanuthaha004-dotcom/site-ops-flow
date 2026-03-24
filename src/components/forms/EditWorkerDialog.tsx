import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Worker, WorkerStatus } from '@/data/mockData';

interface Props {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Worker>) => void;
}

export default function EditWorkerDialog({ worker, open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState({
    staffCode: '', name: '', role: '', department: '', skills: '',
    status: 'Available' as WorkerStatus, currentSite: '', phone: '',
  });

  useEffect(() => {
    if (worker) {
      setForm({
        staffCode: worker.staffCode || '',
        name: worker.name,
        role: worker.role,
        department: worker.department,
        skills: worker.skills.join(', '),
        status: worker.status,
        currentSite: worker.currentSite,
        phone: worker.phone,
      });
    }
  }, [worker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker) return;
    onSave(worker.id, {
      ...form,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Worker</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Staff Code</Label>
              <Input value={form.staffCode} onChange={e => setForm(f => ({ ...f, staffCode: e.target.value }))} placeholder="ST-001" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Full Name *</Label>
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Anil Thorat" />
            </div>
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
                  {['LPG', 'LPG-MAINTENANCE', 'Fire Fighting', 'Small Jobs', 'AMC Gas', 'AMC Fire'].map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as WorkerStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['On Site', 'Available', 'Off Duty'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Skills (comma separated)</Label>
            <Input value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="e.g. Welding, Pipe Fitting" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Current Site</Label>
              <Input value={form.currentSite} onChange={e => setForm(f => ({ ...f, currentSite: e.target.value }))} placeholder="e.g. Motor City" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
          </div>
          <button type="submit" className="w-full py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            Save Changes
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
