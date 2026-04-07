'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Role = 'super_admin' | 'owner' | 'manager' | 'staff';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  account_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

type AuthContextType = {
  user: any;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewPayments: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `settled` flag + hard 3 s timer ensure we ALWAYS exit the loading state
    // even if getSession() or the profiles fetch hangs indefinitely (network
    // issue, Supabase project paused, etc.).
    let settled = false;

    const resolve = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      console.log('[AuthProvider] loading → false');
      setLoading(false);
    };

    const fallback = setTimeout(() => {
      console.warn('[AuthProvider] getSession timed out after 3 s — forcing loading = false');
      resolve();
    }, 3000);

    const getUser = async () => {
      try {
        console.log('[AuthProvider] checking session…');
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) console.error('[AuthProvider] getSession error:', sessionErr.message);
        console.log('[AuthProvider] session:', session ? `found (${session.user.email})` : 'none');
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          console.log('[AuthProvider] profile:', data ? data.role : 'not found', error?.message ?? '');
          setProfile(data ?? null);
        }
      } catch (err) {
        console.error('[AuthProvider] unexpected error:', err);
      } finally {
        resolve();
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(data ?? null);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  const role = profile?.role ?? null;

  const value = {
    user,
    profile,
    role,
    loading,
    isSuperAdmin: role === 'super_admin',
    isOwner: role === 'owner',
    isManager: role === 'manager',
    isStaff: role === 'staff',
    canEdit: ['super_admin', 'owner', 'manager'].includes(role ?? ''),
    canDelete: ['super_admin', 'owner'].includes(role ?? ''),
    canViewPayments: ['super_admin', 'owner', 'manager'].includes(role ?? ''),
    signOut: async () => {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useUser = () => useContext(AuthContext);
