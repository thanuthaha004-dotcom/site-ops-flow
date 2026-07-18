import { useEffect, useState } from 'react';
import { Loader2, Minus, Plus, Truck, Users, Package, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchOccupancyForVehicle,
  upsertOccupancy,
  MATERIAL_OPTIONS,
} from '@/lib/vehicleOccupancy';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface AssignedVehicle {
  number: string;
  type: string | null;
  capacity: number;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function VehicleOccupancyCard() {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<AssignedVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pax, setPax] = useState(0);
  const [material, setMaterial] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: veh } = await supabase
          .from('vehicles')
          .select('number, type, capacity')
          .eq('driver_user_id', user.id)
          .maybeSingle();
        if (!veh) { setLoading(false); return; }
        const v: AssignedVehicle = {
          number: veh.number,
          type: veh.type,
          capacity: veh.capacity ?? 0,
        };
        setVehicle(v);
        const occ = await fetchOccupancyForVehicle(v.number);
        if (occ) {
          setPax(occ.passenger_count);
          setMaterial(occ.material_percent);
          setUpdatedAt(occ.updated_at);
        }
      } catch (e: any) {
        toast({ title: 'Failed to load occupancy', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const cap = vehicle?.capacity ?? 0;
  const paxPct = cap > 0 ? Math.min(100, Math.round((pax / cap) * 100)) : 0;

  const handlePax = (next: number) => {
    const clamped = Math.max(0, Math.min(cap || 999, next));
    setPax(clamped);
    setDirty(true);
  };

  const handleMaterial = (val: string) => {
    setMaterial(parseInt(val, 10));
    setDirty(true);
  };

  const save = async () => {
    if (!vehicle) return;
    setSaving(true);
    try {
      const row = await upsertOccupancy({
        vehicle_number: vehicle.number,
        passenger_count: pax,
        material_percent: material,
      });
      setUpdatedAt(row.updated_at);
      setDirty(false);
      toast({ title: 'Occupancy updated' });
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="kpi-card flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicle occupancy…
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="kpi-card flex items-start gap-3 border-warning/40">
        <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">No vehicle assigned yet</p>
          <p className="text-xs text-muted-foreground">
            Please contact your administrator to be assigned a vehicle before you can update occupancy.
          </p>
        </div>
      </div>
    );
  }

  const materialColor =
    material >= 100 ? 'text-destructive'
    : material >= 75 ? 'text-warning'
    : material >= 50 ? 'text-accent'
    : 'text-success';

  return (
    <div className="kpi-card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Vehicle Occupancy
          </h2>
          <p className="text-base font-bold mt-0.5">
            {vehicle.number}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {vehicle.type ? `${vehicle.type} · ` : ''}{cap} seat{cap === 1 ? '' : 's'}
            </span>
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Updated {timeAgo(updatedAt)}
        </span>
      </div>

      {/* Passengers */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Passengers on board
          </span>
          <span className="text-xs font-semibold">
            {pax} / {cap} seats used
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePax(pax - 1)}
            disabled={pax <= 0}
            className="h-9 w-9 rounded-md border border-input flex items-center justify-center hover:bg-muted disabled:opacity-40"
            aria-label="Decrease passengers"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={0}
            max={cap || undefined}
            value={pax}
            onChange={(e) => handlePax(parseInt(e.target.value || '0', 10))}
            className="h-9 w-16 rounded-md border border-input bg-background text-center text-sm font-semibold"
          />
          <button
            type="button"
            onClick={() => handlePax(pax + 1)}
            disabled={cap > 0 && pax >= cap}
            className="h-9 w-9 rounded-md border border-input flex items-center justify-center hover:bg-muted disabled:opacity-40"
            aria-label="Increase passengers"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <Progress value={paxPct} className="h-2" />
          </div>
        </div>
      </div>

      {/* Material */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Material occupancy
          </span>
          <span className={`text-xs font-semibold ${materialColor}`}>{material}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(material)} onValueChange={handleMaterial}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_OPTIONS.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  {v === 0 ? 'Empty (0%)' : `${v}%`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1">
            <Progress value={material} className="h-2" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {dirty ? 'Save occupancy' : 'Saved'}
      </button>
    </div>
  );
}
