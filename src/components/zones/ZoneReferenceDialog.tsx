import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MapPin, Info, Loader2 } from 'lucide-react';
import { getBuiltInZoneClusters } from '@/lib/tripPlanning';
import { loadZoneMappings, ZONE_LIST, type ZoneLocationRow } from '@/lib/zoneMappings';

interface Props {
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function ZoneReferenceDialog({ triggerClassName, triggerLabel = 'View zone definitions' }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<ZoneLocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const builtIn = getBuiltInZoneClusters();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadZoneMappings()
      .then(setCustom)
      .catch(() => setCustom([]))
      .finally(() => setLoading(false));
  }, [open]);

  const customByZone: Record<string, ZoneLocationRow[]> = {};
  ZONE_LIST.forEach(z => { customByZone[z] = []; });
  custom.forEach(r => { (customByZone[r.zone] ||= []).push(r); });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={triggerClassName || 'text-xs px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5'}
        >
          <Info className="h-3.5 w-3.5" /> {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" /> Zone Definitions
          </DialogTitle>
          <DialogDescription>
            Read-only reference. Locations are automatically mapped to zones for trip optimization. Contact an admin to change any mapping.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {ZONE_LIST.map(zone => {
              const built = builtIn[zone] || [];
              const admin = customByZone[zone] || [];
              return (
                <div key={zone} className="rounded-md border p-3 space-y-2 bg-card">
                  <h4 className="font-semibold text-sm">{zone}</h4>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Built-in</p>
                    <div className="flex flex-wrap gap-1">
                      {built.length ? built.map(k => (
                        <Badge key={k} variant="outline" className="text-[10px] font-normal">{k}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Admin-added</p>
                    <div className="flex flex-wrap gap-1">
                      {admin.length ? admin.map(r => (
                        <Badge key={r.id} variant="secondary" className="text-[10px] font-normal">{r.location_keyword}</Badge>
                      )) : <span className="text-xs text-muted-foreground">None</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
