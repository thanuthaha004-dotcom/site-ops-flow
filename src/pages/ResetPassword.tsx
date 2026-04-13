import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check hash for recovery token
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setReady(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg industrial-gradient flex items-center justify-center">
              <Flame className="h-6 w-6 text-accent" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">OpsCenter</h1>
          </div>
          <p className="text-sm text-muted-foreground">Set your new password</p>
        </div>

        {success ? (
          <div className="kpi-card p-6 text-center space-y-2">
            <p className="text-sm font-medium text-primary">Password updated successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </div>
        ) : !ready ? (
          <div className="kpi-card p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
            <p className="text-xs text-muted-foreground">If this takes too long, try clicking the link in your email again.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 kpi-card">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
