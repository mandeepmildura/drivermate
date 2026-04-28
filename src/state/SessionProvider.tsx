import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { loadDriverProfile } from '../lib/auth';
import type { DriverRow } from '../lib/db';

interface SessionState {
  session: Session | null;
  driver: DriverRow | null;
  loading: boolean;
  configured: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  driver: null,
  loading: true,
  configured: isSupabaseConfigured,
  profileError: null,
  refreshProfile: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [profileError, setProfileError] = useState<string | null>(null);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setDriver(null);
        setProfileError(null);
        lastUserId.current = null;
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (lastUserId.current === session.user.id) return;
    lastUserId.current = session.user.id;
    setLoading(true);
    setProfileError(null);
    loadDriverProfile()
      .then((res) => {
        setDriver(res.driver);
        setProfileError(res.error);
      })
      .finally(() => setLoading(false));
  }, [session]);

  // Re-fetch the driver profile without waiting for an auth event. Used by
  // /register after register_driver RPC links a row, since the auth event
  // fired earlier (during signIn) and won't repeat.
  const refreshProfile = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setProfileError(null);
    try {
      const res = await loadDriverProfile();
      setDriver(res.driver);
      setProfileError(res.error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const value = useMemo<SessionState>(
    () => ({ session, driver, loading, configured: isSupabaseConfigured, profileError, refreshProfile }),
    [session, driver, loading, profileError, refreshProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
