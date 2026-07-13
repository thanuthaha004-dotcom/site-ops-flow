import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getAreaCluster, getBuiltInZoneClusters } from '@/lib/tripPlanning';
import { loadZoneMappings, clearZoneMappingsCache, ZONE_LIST, type ZoneLocationRow } from '@/lib/zoneMappings';
import { fetchTripRequestsByDate } from '@/lib/tripRequestsData';
import { toast } from '@/hooks/use-toast';
import { MapPin, Plus, Trash2, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function ZoneManagement() {
  const builtIn = getBuiltInZoneClusters();
  const [custom, setCustom] = useState<ZoneLocationRow[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [newKw, setNewKw] = useState<Record<string, string>>({});

  async function refresh() {
    clearZoneMappingsCache();
    const rows = await loadZoneMappings(true);
    setCustom(rows);
  }

  async function scanUnmapped() {
    setScanning(true);
    try {
      const today = new Date();
      const dates: string[] = [];
      for (let i = 0; i < 60; i++) dates.push(format(subDays(today, i), 'yyyy-MM-dd'));
      const all = await Promise.all(dates.map(d => fetchTripRequestsByDate(d).catch(() => [])));
      const seen = new Set<string>();
      all.flat().forEach(r => { if (r.site) seen.add(r.site.trim()); });
      const list = [...seen].filter(s => {
        const zone = getAreaCluster(s);
        return !ZONE_LIST.includes(zone); // resolves to "Other" or the raw string
      }).sort();
      setUnmapped(list);
      toast({ title: 'Scan complete', description: `${list.length} unmapped location(s) found` });
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        await scanUnmapped();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customByZone = useMemo(() => {
    const map: Record<string, ZoneLocationRow[]> = {};
    ZONE_LIST.forEach(z => { map[z] = []; });
    custom.forEach(r => { (map[r.zone] ||= []).push(r); });
    return map;
  }, [custom]);

  async function addMapping(zone: string, keyword: string, sourceKey?: string) {
    const kw = keyword.trim();
    if (!kw) return;
    setSaving(sourceKey || kw);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('zone_locations').insert({
        zone,
        location_keyword: kw.toUpperCase(),
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: 'Location mapped', description: `${kw} → ${zone}` });
      await refresh();
      setUnmapped(u => u.filter(x => x !== kw));
      if (sourceKey) setAssignments(a => { const { [sourceKey]: _, ...rest } = a; return rest; });
      else setNewKw(n => ({ ...n, [zone]: '' }));
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  async function deleteMapping(id: string) {
    setSaving(id);
    try {
      const { error } = await supabase.from('zone_locations').delete().eq('id', id);
      if (error) throw error;
      await refresh();
      toast({ title: 'Mapping removed' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-accent" /> Zone Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Map new locations to a zone. Mappings take effect immediately in Trip Planning.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={scanUnmapped} disabled={scanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} /> Rescan
        </Button>
      </div>

      {/* Unmapped */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold">Unmapped Locations</h2>
          <Badge variant="secondary">{unmapped.length}</Badge>
        </div>
        {unmapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">All recent locations are mapped to a zone.</p>
        ) : (
          <div className="space-y-2">
            {unmapped.map(site => (
              <div key={site} className="flex flex-wrap items-center gap-2 p-2 rounded-md border bg-muted/30">
                <span className="font-medium flex-1 min-w-[200px]">{site}</span>
                <Select
                  value={assignments[site] || ''}
                  onValueChange={v => setAssignments(a => ({ ...a, [site]: v }))}
                >
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign zone…" /></SelectTrigger>
                  <SelectContent>
                    {ZONE_LIST.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!assignments[site] || saving === site}
                  onClick={() => addMapping(assignments[site], site, site)}
                >
                  {saving === site ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Zones grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ZONE_LIST.map(zone => (
          <Card key={zone} className="p-4 space-y-3">
            <h3 className="font-semibold text-base">{zone}</h3>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Built-in</p>
              <div className="flex flex-wrap gap-1">
                {(builtIn[zone] || []).map(k => (
                  <Badge key={k} variant="outline" className="text-[11px] font-normal">{k}</Badge>
                ))}
                {!builtIn[zone] && <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Admin-added</p>
              {customByZone[zone]?.length ? (
                <div className="flex flex-wrap gap-1">
                  {customByZone[zone].map(r => (
                    <Badge key={r.id} variant="secondary" className="text-[11px] gap-1 pr-1">
                      {r.location_keyword}
                      <button
                        onClick={() => deleteMapping(r.id)}
                        disabled={saving === r.id}
                        className="ml-1 hover:text-destructive"
                        aria-label={`Remove ${r.location_keyword}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">None yet</span>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                value={newKw[zone] || ''}
                onChange={e => setNewKw(n => ({ ...n, [zone]: e.target.value }))}
                placeholder="Add location…"
                className="h-9"
                onKeyDown={e => { if (e.key === 'Enter') addMapping(zone, newKw[zone] || ''); }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => addMapping(zone, newKw[zone] || '')}
                disabled={!newKw[zone]?.trim() || saving === (newKw[zone] || '').trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
