import { useAuth } from '@/contexts/AuthContext';
import { Clock, LogOut } from 'lucide-react';

export default function PendingApproval() {
  const { profileName, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent mx-auto">
          <Clock className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Awaiting Approval</h1>
          <p className="text-sm text-muted-foreground">
            {profileName ? `Hi ${profileName}, your` : 'Your'} driver account is pending admin approval.
            Once approved, you'll see your assigned trips here.
          </p>
        </div>
        <button onClick={signOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
