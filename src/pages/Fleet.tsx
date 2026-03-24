import { useState, useEffect } from 'react';
import { fetchVehicles, insertVehicle, deleteVehicleDb } from '@/lib/supabaseData';
import type { Vehicle } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { Fuel, Route, Gauge, Trash2, Download } from 'lucide-react';
import AddVehicleDialog from '@/components/forms/AddVehicleDialog';
import ExcelUploadButton from '@/components/forms/ExcelUploadButton';
import { parseVehiclesExcel } from '@/lib/excelImport';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';

export default function Fleet() {
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = async () => {
    try {
      const data = await fetchVehicles();
      setVehicleList(data);
    } catch { toast({ title: 'Failed to load vehicles', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadVehicles(); }, []);

  const avgUtil = Math.round(vehicleList.reduce((a, v) => a + v.utilization, 0) / (vehicleList.length || 1));

  const handleAdd = async (vehicle: Omit<Vehicle, 'id'>) => {
    try {
      const created = await insertVehicle(vehicle);
      setVehicleList(prev => [created, ...prev]);
      toast({ title: 'Vehicle added' });
    } catch { toast({ title: 'Failed to add vehicle', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicleDb(id);
      setVehicleList(prev => prev.filter(v => v.id !== id));
      toast({ title: 'Vehicle deleted' });
    } catch { toast({ title: 'Failed to delete vehicle', variant: 'destructive' }); }
  };

  const handleExport = () => {
    const data = vehicleList.map(v => ({
      'Vehicle Number': v.number, Type: v.type, Brand: v.brand, Department: v.department,
      Capacity: v.capacity, Status: v.status, Driver: v.driver,
      'Utilization %': v.utilization, 'Fuel Level %': v.fuelLevel, 'Current Route': v.currentRoute,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
    XLSX.writeFile(wb, 'vehicles.xlsx');
    toast({ title: 'Excel downloaded' });
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await parseVehiclesExcel(file);
      for (const v of imported) {
        const created = await insertVehicle(v);
        setVehicleList(prev => [created, ...prev]);
      }
      toast({ title: `Imported ${imported.length} vehicles` });
    } catch { toast({ title: 'Failed to parse file', variant: 'destructive' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading vehicles...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Management</h1>
          <p className="text-muted-foreground text-sm">{vehicleList.length} vehicles • {avgUtil}% avg utilization</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors">
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <ExcelUploadButton label="Import Excel" onFileSelect={handleImport} />
          <AddVehicleDialog onAdd={handleAdd}>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors">
              + Add Vehicle
            </button>
          </AddVehicleDialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card"><p className="text-sm text-muted-foreground">Active</p><p className="text-3xl font-bold text-success">{vehicleList.filter(v => v.status === 'Active').length}</p></div>
        <div className="kpi-card"><p className="text-sm text-muted-foreground">Idle</p><p className="text-3xl font-bold text-muted-foreground">{vehicleList.filter(v => v.status === 'Idle').length}</p></div>
        <div className="kpi-card"><p className="text-sm text-muted-foreground">Maintenance</p><p className="text-3xl font-bold text-warning">{vehicleList.filter(v => v.status === 'Maintenance').length}</p></div>
        <div className="kpi-card"><p className="text-sm text-muted-foreground">Avg Utilization</p><p className="text-3xl font-bold">{avgUtil}%</p></div>
      </div>

      {/* Vehicle Cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {vehicleList.map((v) => (
          <div key={v.id} className={`kpi-card ${v.status === 'Maintenance' ? 'border-warning/40' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{v.number}</h3>
                <p className="text-xs text-muted-foreground">{v.type}{v.brand ? ` • ${v.brand}` : ''} • Cap: {v.capacity}</p>
                {v.department && <p className="text-xs text-muted-foreground">{v.department}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  v.status === 'Active' ? 'status-active' : v.status === 'Maintenance' ? 'status-warning' : 'status-idle'
                }`}>{v.status}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {v.number}?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently remove this vehicle.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(v.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Gauge className="h-3.5 w-3.5" />Utilization</span>
                <div className="flex items-center gap-2"><Progress value={v.utilization} className="h-2 w-20" /><span className="text-xs font-medium">{v.utilization}%</span></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Fuel className="h-3.5 w-3.5" />Fuel</span>
                <div className="flex items-center gap-2"><Progress value={v.fuelLevel} className="h-2 w-20" /><span className={`text-xs font-medium ${v.fuelLevel < 35 ? 'text-destructive' : ''}`}>{v.fuelLevel}%</span></div>
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
      {vehicleList.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">No vehicles found. Add your first vehicle above.</div>
      )}
    </div>
  );
}
