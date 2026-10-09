'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, profile: null, loading: true, isAdmin: false,
  refreshProfile: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      return;
    }
    const { data } = await getSupabase()
      .from('profiles')
      .select('id,email,username,balance,role,account_status,created_at')
      .eq('id', u.id)
      .maybeSingle();
    setProfile((data as Profile) || null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    let active = true;
    sb.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user);
      await loadProfile(data.user);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // evitar chamadas ao Supabase dentro do callback (deadlock conhecido)
      setTimeout(() => loadProfile(u), 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // saldo em tempo real
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb
      .channel(`profile-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          setProfile((p) => ({ ...(p as Profile), ...(payload.new as Partial<Profile>) } as Profile));
        }
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [user]);

  const refreshProfile = useCallback(async () => loadProfile(user), [loadProfile, user]);
  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, profile, loading, isAdmin: profile?.role === 'admin', refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
