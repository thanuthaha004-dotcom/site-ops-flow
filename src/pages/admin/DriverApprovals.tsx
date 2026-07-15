import { useEffect, useState } from 'react';
import { Loader2, Check, X, UserCog, Mail, Copy, KeyRound, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  fetchPendingApprovals,
  fetchAllUsersByRole,
  approveUser,
  rejectUser,
  sendPasswordReset,
  type PendingDriver,
  type ApprovableRole,
  type DirectoryUser,
} from '@/lib/driverData';

type TabKey = ApprovableRole | 'all';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'driver', label: 'Drivers' },
  { key: 'engineer', label: 'Engineers' },
];

type PendingItem = PendingDriver & { role: ApprovableRole };
type DirItem = DirectoryUser & { role: ApprovableRole };

export default function DriverApprovals() {
  const [tab, setTab] = useState<TabKey>('all');
  const [pendingList, setPendingList] = useState<PendingItem[]>([]);
  const [directory, setDirectory] = useState<DirItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async (t: TabKey) => {
    setLoading(true);
    try {
      const roles: ApprovableRole[] = t === 'all' ? ['driver', 'engineer'] : [t];
      const results = await Promise.all(roles.map(async r => {
        const [pend, all] = await Promise.all([
          fetchPendingApprovals(r),
          fetchAllUsersByRole(r),
        ]);
        return {
          pend: pend.map(p => ({ ...p, role: r })),
          all: all.map(u => ({ ...u, role: r })),
        };
      }));
      setPendingList(results.flatMap(r => r.pend));
      setDirectory(
        results.flatMap(r => r.all).sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(tab); }, [tab]);

  const act = async (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key);
    try { await fn(); toast({ title: msg }); await load(tab); }
    catch (e: any) { toast({ title: 'Action failed', description: e.message, variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({ title: 'Email copied', description: email });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const resetPw = async (email: string) => {
    setBusy(email);
    try {
      await sendPasswordReset(email);
      toast({ title: 'Reset link sent', description: `Password reset email sent to ${email}` });
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const roleLabel = (r: ApprovableRole) => r === 'driver' ? 'Driver' : 'Engineer';
  const tabNoun = tab === 'all' ? 'users' : tab === 'driver' ? 'drivers' : 'engineers';
  const q = search.trim().toLowerCase();
  const filteredDir = q
    ? directory.filter(u =>
        u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : directory;


  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Users & Approvals</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Approve new sign-ups and view all registered {tabNoun}.
        Passwords are securely hashed and cannot be shown — use <span className="font-medium">Reset password</span> to email a reset link if a user forgets theirs.
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
      ) : (
        <>
          {/* Pending Approvals */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Awaiting approval ({pendingList.length})
            </h2>
            {pendingList.length === 0 ? (
              <div className="kpi-card text-center py-6 text-sm text-muted-foreground">
                No {tabNoun} awaiting approval.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingList.map(d => (
                  <div key={d.role_id} className="kpi-card flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.full_name || '(no name)'}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button disabled={busy === d.role_id}
                        onClick={() => act(d.role_id, () => approveUser(d.role_id), `${roleLabel(d.role)} approved`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button disabled={busy === d.role_id}
                        onClick={() => act(d.role_id, () => rejectUser(d.role_id), `${roleLabel(d.role)} rejected`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 disabled:opacity-50">
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Directory */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                All registered {tabNoun} ({directory.length})
              </h2>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="pl-8 pr-2 py-1.5 rounded-md border border-input bg-background text-xs w-56 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {filteredDir.length === 0 ? (
              <div className="kpi-card text-center py-6 text-sm text-muted-foreground">
                No matching {tabNoun}.
              </div>
            ) : (
              <div className="kpi-card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Role</th>
                        <th className="text-left px-3 py-2 font-medium">Email (login ID)</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-right px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDir.map(u => (
                        <tr key={u.role_id} className="border-t border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{u.full_name || <span className="text-muted-foreground italic">(no name)</span>}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.role === 'driver' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'}`}>
                              {roleLabel(u.role)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs">{u.email}</span>
                              <button onClick={() => copyEmail(u.email)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Copy email">
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {u.pending ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">Pending</span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">Active</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button disabled={busy === u.email || !u.email}
                              onClick={() => resetPw(u.email)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-[11px] font-semibold hover:bg-secondary/80 disabled:opacity-50">
                              <KeyRound className="h-3 w-3" /> Reset password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
