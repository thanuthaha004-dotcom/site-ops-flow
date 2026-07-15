import { MapPin, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LocationStatus } from '@/hooks/useDriverLocationBroadcast';

interface Props {
  status: LocationStatus;
  lastSentAt: Date | null;
  lastError: string | null;
  dismissed: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

function timeAgo(d: Date | null): string {
  if (!d) return 'never';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function LocationPermissionCard({
  status, lastSentAt, lastError, dismissed, onEnable, onDismiss,
}: Props) {
  if (status === 'granted') {
    return (
      <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-success/10 text-success border border-success/20">
        <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
        <MapPin className="h-3.5 w-3.5" />
        <span className="font-medium">Location sharing on</span>
        <span className="text-muted-foreground ml-auto">Updated {timeAgo(lastSentAt)}</span>
      </div>
    );
  }

  if (status === 'unsupported') return null;
  if (dismissed && status !== 'denied') return null;

  const isDenied = status === 'denied';

  return (
    <div className="kpi-card border-accent/30 bg-accent/5">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-md ${isDenied ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-accent'}`}>
          {isDenied ? <AlertTriangle className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">
            {isDenied ? 'Location access blocked' : 'Share your location'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isDenied
              ? 'Dispatch cannot see your vehicle. Enable location in your browser settings (tap the lock icon in the address bar → Site settings → Location → Allow), then reload this page.'
              : 'Let dispatch see where your vehicle is so they can send you the closest jobs when something urgent comes up. Runs only while this app is open.'}
          </p>
          {lastError && !isDenied && (
            <p className="text-xs text-destructive mt-1">{lastError}</p>
          )}
          {!isDenied && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={onEnable} className="gap-1">
                <Check className="h-3.5 w-3.5" /> Allow location
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1">
                <X className="h-3.5 w-3.5" /> Not now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
