import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Vehicle, VehicleStatus } from '@/data/mockData';

interface Props {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Vehicle>) => Promise<void> | void;
}

export default function EditVehicleDialog({ vehicle, open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState<Vehicle | null>(vehicle);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(vehicle); }, [vehicle]);

  if (!form) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form.id, {
        number: form.number,
        type: form.type,
        brand: form.brand,
        department: form.department,
        capacity: form.capacity,
        status: form.status,
        driver: form.driver,
        utilization: form.utilization,
        fuelLevel: form.fuelLevel,
        currentRoute: form.currentRoute,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Vehicle — {form.number}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Number *</Label>
            <Input required value={form.number} onChange={e => setForm(f => f && ({ ...f, number: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => f && ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['3 Ton Pickup', '1 Ton Pickup', 'Van Passenger', 'Car'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input value={form.brand} onChange={e => setForm(f => f && ({ ...f, brand: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={e => setForm(f => f && ({ ...f, department: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={form.capacity} onChange={e => setForm(f => f && ({ ...f, capacity: +e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status (Availability)</Label>
              <Select value={form.status} onValueChange={(v: VehicleStatus) => setForm(f => f && ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['Active', 'Idle', 'Maintenance'] as VehicleStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Driver</Label>
              <Input value={form.driver} onChange={e => setForm(f => f && ({ ...f, driver: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Utilization %</Label>
              <Input type="number" min={0} max={100} value={form.utilization} onChange={e => setForm(f => f && ({ ...f, utilization: Math.max(0, Math.min(100, +e.target.value)) }))} />
            </div>
            <div className="space-y-2">
              <Label>Fuel Level %</Label>
              <Input type="number" min={0} max={100} value={form.fuelLevel} onChange={e => setForm(f => f && ({ ...f, fuelLevel: Math.max(0, Math.min(100, +e.target.value)) }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Current Route / Location</Label>
            <Input value={form.currentRoute} onChange={e => setForm(f => f && ({ ...f, currentRoute: e.target.value }))} placeholder="e.g. Al Quoz → Jebel Ali" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="flex-1 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
