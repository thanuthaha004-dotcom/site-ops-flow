import { useEffect, useState } from 'react';
import { Loader2, Check, X, UserCog } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  fetchPendingApprovals,
  approveUser,
  rejectUser,
  type PendingDriver,
  type ApprovableRole,
} from '@/lib/driverData';

const TABS: { key: ApprovableRole; label: string }[] = [
  { key: 'driver', label: 'Drivers' },
  { key: 'engineer', label: 'Engineers' },
];

export default function DriverApprovals() {
  const [tab, setTab] = useState<ApprovableRole>('driver');
  const [list, setList] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (role: ApprovableRole) => {
    setLoading(true);
    try { setList(await fetchPendingApprovals(role)); }
    catch (e: any) { toast({ title: 'Failed to load', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); }, [tab]);

  const act = async (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key);
    try { await fn(); toast({ title: msg }); await load(tab); }
    catch (e: any) { toast({ title: 'Action failed', description: e.message, variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const roleLabel = tab === 'driver' ? 'Driver' : 'Engineer';

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">User Approvals</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Users who have signed up and are awaiting approval.
      </p>

      <div className="flex rounded-md border border-input overflow-hidden w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="kpi-card text-center py-10 text-sm text-muted-foreground">
          No {roleLabel.toLowerCase()}s awaiting approval.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(d => (
            <div key={d.role_id} className="kpi-card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{d.full_name || '(no name)'}</p>
                <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{roleLabel}</p>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === d.role_id}
                  onClick={() => act(d.role_id, () => approveUser(d.role_id), `${roleLabel} approved`)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button disabled={busy === d.role_id}
                  onClick={() => act(d.role_id, () => rejectUser(d.role_id), `${roleLabel} rejected`)}
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
