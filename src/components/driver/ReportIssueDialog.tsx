import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Send, StickyNote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  addTripIssueNote, fetchTripIssueNotes, type TripIssueNote,
} from '@/lib/tripIssueNotes';

interface Props {
  tripId: string;
  tripLabel?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ReportIssueDialog({ tripId, tripLabel, open, onOpenChange }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<TripIssueNote[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setNotes(await fetchTripIssueNotes(tripId));
    } catch (e: any) {
      // silent — RLS may hide from non-driver views
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setNote(''); reload(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId]);

  const submit = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addTripIssueNote(tripId, note);
      toast({ title: 'Issue reported', description: 'Admin has been notified.' });
      setNote('');
      await reload();
    } catch (e: any) {
      toast({ title: 'Failed to submit', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Report an issue
          </DialogTitle>
        </DialogHeader>
        {tripLabel && <p className="text-xs text-muted-foreground -mt-2">{tripLabel}</p>}

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New note</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Describe the issue (e.g. vehicle breakdown, missing passenger, blocked road)…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{note.length}/2000</span>
            <button
              onClick={submit}
              disabled={saving || !note.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5" /> Previous notes
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes reported yet.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-2">
              {notes.map(n => (
                <div key={n.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {n.driver_name || 'Driver'} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
