import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'engineer';
export const PASSWORD_RECOVERY_STORAGE_KEY = 'opscenter-password-recovery';

const saveRecoveryState = (userId: string) => {
  sessionStorage.setItem(
    PASSWORD_RECOVERY_STORAGE_KEY,
    JSON.stringify({ userId, createdAt: Date.now() }),
  );
};

const clearRecoveryState = () => {
  sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
};

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profileName: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch user role:', error);
      return null;
    }

    return (data?.role as AppRole) || null;
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch user profile:', error);
      return '';
    }

    return data?.full_name || '';
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setProfileName('');
        setLoading(false);
        return;
      }

      const [nextRole, nextProfileName] = await Promise.all([
        fetchRole(nextSession.user.id),
        fetchProfile(nextSession.user.id),
      ]);

      if (!mounted) return;

      setRole(nextRole);
      setProfileName(nextProfileName);
      setLoading(false);
    };

    supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch((error) => {
        console.error('Failed to restore session:', error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setRole(null);
        setProfileName('');
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' && nextSession?.user?.id) {
        saveRecoveryState(nextSession.user.id);
      }

      if (event === 'SIGNED_OUT') {
        clearRecoveryState();
      }

      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUp = async (email: string, password: string, fullName: string, selectedRole: AppRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: selectedRole });
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfileName('');
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profileName, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
