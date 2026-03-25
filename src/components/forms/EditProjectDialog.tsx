import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EngineerSelect from '@/components/forms/EngineerSelect';
import type { Project, ProjectType, ProjectStatus, Priority, WorkType } from '@/data/mockData';

const workTypes: WorkType[] = ['Material Delivery', 'Pipe Installation', 'Kitchen Installation', 'Detection System', 'Testing', 'Snag Work', 'DCD Inspection', 'Handing Over'];

interface Props {
  project: Project;
  onSave: (updates: Partial<Project>) => void;
  children: React.ReactNode;
}

export default function EditProjectDialog({ project, onSave, children }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: project.code,
    name: project.name,
    type: project.type,
    site: project.site,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate,
    endDate: project.endDate,
    engineer: project.engineer,
    workersRequired: project.workersRequired,
    workerNamesText: (project.workerNames || []).join(', '),
    progress: project.progress,
    workType: project.workType || '',
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        code: project.code,
        name: project.name,
        type: project.type,
        site: project.site,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        engineer: project.engineer,
        workersRequired: project.workersRequired,
        workerNamesText: (project.workerNames || []).join(', '),
        progress: project.progress,
        workType: project.workType || '',
      });
    }
    setOpen(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const workerNames = form.workerNamesText.split(',').map(n => n.trim()).filter(Boolean);
    onSave({
      code: form.code,
      name: form.name,
      type: form.type,
      site: form.site,
      status: form.status,
      priority: form.priority,
      startDate: form.startDate,
      endDate: form.endDate,
      engineer: form.engineer,
      workersRequired: form.workersRequired,
      workerNames,
      workersAssigned: workerNames.length,
      progress: form.progress,
      workType: form.workType,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Project Code</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ProjectType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['LPG', 'Fire Fighting', 'Small Job', 'AMC Gas', 'AMC Fire'] as ProjectType[]).map(t => (
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ProjectStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['Active', 'Scheduled', 'Completed', 'On Hold'] as ProjectStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progress %</Label>
              <Input type="number" min={0} max={100} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: +e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Work Type</Label>
            <Select value={form.workType} onValueChange={v => setForm(f => ({ ...f, workType: v }))}>
              <SelectTrigger><SelectValue placeholder="Select work type" /></SelectTrigger>
              <SelectContent>
                {workTypes.map(w => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Site Location *</Label>
            <Input required value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Engineer</Label>
              <Input value={form.engineer} onChange={e => setForm(f => ({ ...f, engineer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Workers Needed</Label>
              <Input type="number" min={1} value={form.workersRequired} onChange={e => setForm(f => ({ ...f, workersRequired: +e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Workers Names</Label>
            <textarea value={form.workerNamesText} onChange={e => setForm(f => ({ ...f, workerNamesText: e.target.value }))}
              placeholder="Comma separated names"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px]" />
          </div>
          <button type="submit" className="w-full py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            Save Changes
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
