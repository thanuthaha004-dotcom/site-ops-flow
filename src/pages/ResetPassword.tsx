import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PASSWORD_RECOVERY_STORAGE_KEY } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';

const INVALID_LINK_MESSAGE = 'This password reset link is invalid or has expired. Please request a new one.';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    let mounted = true;

    const clearRecoveryUrl = () => {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);
    };

    const clearRecoveryState = () => {
      sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    };

    const saveRecoveryState = (userId: string) => {
      sessionStorage.setItem(
        PASSWORD_RECOVERY_STORAGE_KEY,
        JSON.stringify({ userId, createdAt: Date.now() }),
      );
    };

    const getStoredRecoveryState = () => {
      const storedValue = sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY);

      if (!storedValue) {
        return null;
      }

      try {
        const parsed = JSON.parse(storedValue) as { userId?: string; createdAt?: number };
        if (!parsed.userId || !parsed.createdAt) {
          clearRecoveryState();
          return null;
        }

        if (Date.now() - parsed.createdAt > 30 * 60 * 1000) {
          clearRecoveryState();
          return null;
        }

        return parsed;
      } catch {
        clearRecoveryState();
        return null;
      }
    };

    const markReady = () => {
      if (!mounted) return;
      setError('');
      setReady(true);
      setVerifying(false);
    };

    const markInvalid = (message = INVALID_LINK_MESSAGE) => {
      if (!mounted) return;
      clearRecoveryState();
      setReady(false);
      setVerifying(false);
      setError(message);
    };

    const establishRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = queryParams.get('code');
      const tokenHash = queryParams.get('token_hash') ?? hashParams.get('token_hash');
      const type = queryParams.get('type') ?? hashParams.get('type');
      const hasRecoveryParams =
        type === 'recovery' ||
        Boolean(code) ||
        Boolean(tokenHash) ||
        (Boolean(accessToken) && Boolean(refreshToken));

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Recovery session missing after code exchange.');

          saveRecoveryState(user.id);
          clearRecoveryUrl();
          markReady();
          return;
        }

        if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) throw verifyError;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Recovery session missing after token verification.');

          saveRecoveryState(user.id);
          clearRecoveryUrl();
          markReady();
          return;
        }

        if (accessToken && refreshToken && type === 'recovery') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Recovery session missing after session setup.');

          saveRecoveryState(user.id);
          clearRecoveryUrl();
          markReady();
          return;
        }

        const storedRecoveryState = getStoredRecoveryState();
        if (storedRecoveryState) {
          const { data: { user } } = await supabase.auth.getUser();

          if (user?.id === storedRecoveryState.userId) {
            markReady();
            return;
          }
        }

        if (!hasRecoveryParams) {
          markInvalid();
          return;
        }

        markInvalid();
      } catch (recoveryError) {
        console.error('Failed to verify reset link:', recoveryError);
        markInvalid();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user?.id) {
        saveRecoveryState(session.user.id);
        clearRecoveryUrl();
        markReady();
      }
    });

    void establishRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!ready) {
      setError(INVALID_LINK_MESSAGE);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
      setError(INVALID_LINK_MESSAGE);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      window.setTimeout(() => {
        sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
        void supabase.auth.signOut().finally(() => navigate('/login', { replace: true }));
      }, 1500);
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
        ) : verifying ? (
          <div className="kpi-card p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
            <p className="text-xs text-muted-foreground">If this takes too long, request a new reset email from the sign-in page.</p>
          </div>
        ) : !ready ? (
          <div className="kpi-card p-6 text-center space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Reset link expired</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Back to Sign In
            </button>
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
