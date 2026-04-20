import { useEffect, useState } from 'react';
import { Loader2, Check, X, UserCog } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fetchPendingDrivers, approveDriver, rejectDriver, type PendingDriver } from '@/lib/driverData';

export default function DriverApprovals() {
  const [list, setList] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setList(await fetchPendingDrivers()); }
    catch (e: any) { toast({ title: 'Failed to load', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const act = async (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key);
    try { await fn(); toast({ title: msg }); await load(); }
    catch (e: any) { toast({ title: 'Action failed', description: e.message, variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Driver Approvals</h1>
      </div>
      <p className="text-sm text-muted-foreground">Drivers who have signed up and are awaiting approval.</p>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="kpi-card text-center py-10 text-sm text-muted-foreground">No drivers awaiting approval.</div>
      ) : (
        <div className="space-y-2">
          {list.map(d => (
            <div key={d.role_id} className="kpi-card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{d.full_name || '(no name)'}</p>
                <p className="text-xs text-muted-foreground truncate">{d.email}</p>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === d.role_id}
                  onClick={() => act(d.role_id, () => approveDriver(d.role_id), 'Driver approved')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button disabled={busy === d.role_id}
                  onClick={() => act(d.role_id, () => rejectDriver(d.role_id), 'Driver rejected')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
