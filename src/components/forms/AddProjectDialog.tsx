import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project, ProjectType, ProjectStatus, Priority } from '@/data/mockData';

interface Props {
  onAdd: (project: Project) => void;
  children: React.ReactNode;
}

export default function AddProjectDialog({ onAdd, children }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'LPG' as ProjectType, site: '', status: 'Active' as ProjectStatus,
    priority: 'Medium' as Priority, startDate: '', endDate: '', engineer: '',
    workersRequired: 1, workerNamesText: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const workerNames = form.workerNamesText.split(',').map(n => n.trim()).filter(Boolean);
    const { workerNamesText, ...rest } = form;
    const project: Project = {
      id: `PRJ-${String(Date.now()).slice(-4)}`,
      ...rest,
      workerNames,
      progress: 0,
      workersAssigned: workerNames.length,
    };
    onAdd(project);
    setOpen(false);
    setForm({ name: '', type: 'LPG', site: '', status: 'Active', priority: 'Medium', startDate: '', endDate: '', engineer: '', workersRequired: 1, workerNamesText: '' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add New Project</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ambuja Tower LPG" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ProjectType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['LPG', 'Fire Fighting', 'Small Job', 'AMC'] as ProjectType[]).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['High', 'Medium', 'Low'] as Priority[]).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Site Location *</Label>
            <Input required value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} placeholder="e.g. Andheri East, Mumbai" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Engineer *</Label>
              <Input required value={form.engineer} onChange={e => setForm(f => ({ ...f, engineer: e.target.value }))} placeholder="Name" />
            </div>
            <div className="space-y-2">
              <Label>Workers Needed</Label>
              <Input type="number" min={1} value={form.workersRequired} onChange={e => setForm(f => ({ ...f, workersRequired: +e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Workers Names</Label>
            <textarea
              value={form.workerNamesText}
              onChange={e => setForm(f => ({ ...f, workerNamesText: e.target.value }))}
              placeholder="Enter names separated by commas (e.g. Ahmed, Ravi, John)"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px]"
            />
          </div>
          <button type="submit" className="w-full py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            Add Project
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
