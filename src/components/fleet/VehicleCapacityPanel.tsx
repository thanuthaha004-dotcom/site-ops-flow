import { useEffect, useState } from 'react';
import { Truck, Users, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAllOccupancy } from '@/lib/vehicleOccupancy';

interface VehRow { number: string; type: string | null; capacity: number; driver: string | null; }

/**
 * Read-only capacity panel shown to engineers and admins so they can see
 * live vehicle occupancy before requesting a trip.
 */
export default function VehicleCapacityPanel() {
  const [vehicles, setVehicles] = useState<VehRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const { rows: occupancyRows } = useAllOccupancy();
  const occByVeh = new Map(occupancyRows.map(o => [o.vehicle_number, o]));

  useEffect(() => {
    supabase.from('vehicles')
      .select('number, type, capacity, driver, status')
      .neq('status', 'Maintenance')
      .order('number')
      .then(({ data }) => {
        if (data) setVehicles(data as VehRow[]);
      });
  }, []);

  const visible = expanded ? vehicles : vehicles.slice(0, 6);

  const badgeColor = (mat: number) =>
    mat >= 100 ? 'bg-destructive/15 text-destructive'
    : mat >= 75 ? 'bg-warning/15 text-warning'
    : mat >= 50 ? 'bg-accent/15 text-accent'
    : 'bg-success/15 text-success';

  if (vehicles.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" /> Live Vehicle Capacity
        </h3>
        <span className="text-xs text-muted-foreground">Updates in real time</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map(v => {
          const occ = occByVeh.get(v.number);
          const pax = occ?.passenger_count ?? 0;
          const mat = occ?.material_percent ?? 0;
          return (
            <div key={v.number} className="border rounded-md p-2 text-xs">
              <div className="font-semibold text-sm">{v.number}
                <span className="ml-1 font-normal text-muted-foreground text-[11px]">
                  {v.type || ''}
                </span>
              </div>
              {v.driver && <div className="text-muted-foreground text-[11px] mb-1">{v.driver}</div>}
              <div className="flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                  <Users className="h-3 w-3" /> {pax}/{v.capacity}
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${badgeColor(mat)}`}>
                  <Package className="h-3 w-3" /> {mat}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {vehicles.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all {vehicles.length}</>}
        </button>
      )}
    </div>
  );
}
