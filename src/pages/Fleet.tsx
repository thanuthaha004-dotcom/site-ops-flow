import { useState } from 'react';
import { getVehicles, addVehicle } from '@/lib/localStorage';
import type { Vehicle } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { Fuel, Route, Gauge } from 'lucide-react';
import AddVehicleDialog from '@/components/forms/AddVehicleDialog';

export default function Fleet() {
  const [vehicleList, setVehicleList] = useState<Vehicle[]>(getVehicles);
  const avgUtil = Math.round(vehicleList.reduce((a, v) => a + v.utilization, 0) / (vehicleList.length || 1));

  const handleAdd = (vehicle: Vehicle) => {
    const updated = addVehicle(vehicle);
    setVehicleList(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Management</h1>
          <p className="text-muted-foreground text-sm">{vehicleList.length} vehicles • {avgUtil}% avg utilization</p>
        </div>
        <AddVehicleDialog onAdd={handleAdd}>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
            + Add Vehicle
          </button>
        </AddVehicleDialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-3xl font-bold text-success">{vehicleList.filter(v => v.status === 'Active').length}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Idle</p>
          <p className="text-3xl font-bold text-muted-foreground">{vehicleList.filter(v => v.status === 'Idle').length}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Maintenance</p>
          <p className="text-3xl font-bold text-warning">{vehicleList.filter(v => v.status === 'Maintenance').length}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Avg Utilization</p>
          <p className="text-3xl font-bold">{avgUtil}%</p>
        </div>
      </div>

      {/* Vehicle Cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {vehicleList.map((v) => (
          <div key={v.id} className={`kpi-card ${v.status === 'Maintenance' ? 'border-warning/40' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{v.number}</h3>
                <p className="text-xs text-muted-foreground">{v.type} • Cap: {v.capacity}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                v.status === 'Active' ? 'status-active' : v.status === 'Maintenance' ? 'status-warning' : 'status-idle'
              }`}>
                {v.status}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Gauge className="h-3.5 w-3.5" />Utilization</span>
                <div className="flex items-center gap-2">
                  <Progress value={v.utilization} className="h-2 w-20" />
                  <span className="text-xs font-medium">{v.utilization}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Fuel className="h-3.5 w-3.5" />Fuel</span>
                <div className="flex items-center gap-2">
                  <Progress value={v.fuelLevel} className="h-2 w-20" />
                  <span className={`text-xs font-medium ${v.fuelLevel < 35 ? 'text-destructive' : ''}`}>{v.fuelLevel}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">Driver</span>
                <span className="text-xs">{v.driver}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Route className="h-3 w-3" />{v.currentRoute}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
