import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Vehicle, VehicleStatus } from '@/data/mockData';

interface Props {
  onAdd: (vehicle: Vehicle) => void;
  children: React.ReactNode;
}

export default function AddVehicleDialog({ onAdd, children }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    number: '', type: '3 Ton Pickup', capacity: 6,
    status: 'Idle' as VehicleStatus, driver: '', currentRoute: '—',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vehicle: Vehicle = {
      id: `VH-${String(Date.now()).slice(-4)}`,
      ...form,
      utilization: 0,
      fuelLevel: 100,
    };
    onAdd(vehicle);
    setOpen(false);
    setForm({ number: '', type: 'Utility Van', capacity: 6, status: 'Idle', driver: '', currentRoute: '—' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add New Vehicle</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Number *</Label>
            <Input required value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="e.g. MH-04-AB-1234" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['3 Ton Pickup', '1 Ton Pickup', 'Van Passenger', 'Car'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Driver Name</Label>
            <Input value={form.driver} onChange={e => setForm(f => ({ ...f, driver: e.target.value }))} placeholder="Driver name" />
          </div>
          <button type="submit" className="w-full py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            Add Vehicle
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
