import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type AppRole } from '@/contexts/AuthContext';
import { Flame } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('engineer');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    if (forgotMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(error.message);
      else setInfo('Password reset link sent! Check your email.');
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      const res = await signIn(email, password);
      if (res.error) setError(res.error);
    } else {
      if (!fullName.trim()) { setError('Full name is required'); setLoading(false); return; }
      const res = await signUp(email, password, fullName, role);
      if (res.error) setError(res.error);
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
          <p className="text-sm text-muted-foreground">
            {forgotMode ? 'Enter your email to reset password' : mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 kpi-card">
          {mode === 'signup' && !forgotMode && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Ahmed Khan" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com" />
          </div>
          {!forgotMode && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••" />
            </div>
          )}
          {mode === 'signup' && !forgotMode && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <div className="flex rounded-md border border-input overflow-hidden">
                <button type="button" onClick={() => setRole('engineer')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${role === 'engineer' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                  Engineer
                </button>
                <button type="button" onClick={() => setRole('admin')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-input ${role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                  Admin
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-primary">{info}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? 'Please wait...' : forgotMode ? 'Send Reset Link' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          {mode === 'login' && !forgotMode && (
            <button type="button" onClick={() => { setForgotMode(true); setError(''); setInfo(''); }}
              className="w-full text-sm text-muted-foreground hover:text-accent transition-colors">
              Forgot password?
            </button>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {forgotMode ? (
            <button onClick={() => { setForgotMode(false); setError(''); setInfo(''); }}
              className="text-accent font-medium hover:underline">
              Back to Sign In
            </button>
          ) : (
            <>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="text-accent font-medium hover:underline">
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 kpi-card">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Ahmed Khan" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••" />
          </div>
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <div className="flex rounded-md border border-input overflow-hidden">
                <button type="button" onClick={() => setRole('engineer')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${role === 'engineer' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                  Engineer
                </button>
                <button type="button" onClick={() => setRole('admin')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-input ${role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                  Admin
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            className="text-accent font-medium hover:underline">
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
