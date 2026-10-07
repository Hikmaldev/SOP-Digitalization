import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken, setToken } from '../api/client';
import { login as apiLogin, me as apiMe } from '../api/endpoints';
import type { ApiUser } from '../types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  // Start in "loading" only when a token exists; otherwise we are signed out.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // Restore the session from the stored token on first load.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;

    apiMe()
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from the API signs the user out; the router redirects to /login.
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('soply:unauthorized', onUnauthorized);
    return () => window.removeEventListener('soply:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
