import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { clearToken, onUnauthorized, setToken } from '@/lib/auth';

// ============================================================================
// AuthProvider — the app's single source of auth truth.
//
// On boot it probes GET /auth/me (which the API guard answers for a valid JWT,
// a valid API key, OR when auth is disabled entirely for local dev). Success →
// authenticated; a 401 → show the login screen. After login the forever-JWT is
// persisted (localStorage) so it survives reloads. A 401 on any later request
// evicts the token and drops back to login (see lib/api.ts + lib/auth.ts).
// ============================================================================

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.me(),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Reflect the boot probe into local auth state.
  useEffect(() => {
    if (meQuery.isSuccess && meQuery.data?.authenticated) {
      setAuthed(true);
      setUsername(meQuery.data.username ?? null);
    } else if (meQuery.isError) {
      setAuthed(false);
      setUsername(null);
    }
  }, [meQuery.isSuccess, meQuery.isError, meQuery.data]);

  // A rejected credential mid-session bounces us to login. We only flip state
  // here (the token is already cleared by the API layer) — no qc.clear(), which
  // would refetch the still-mounted me-query and could loop.
  useEffect(
    () =>
      onUnauthorized(() => {
        setAuthed(false);
        setUsername(null);
      }),
    [],
  );

  const login = async (user: string, password: string) => {
    const res = await api.login(user, password);
    setToken(res.token);
    setAuthed(true);
    setUsername(res.username);
    // Refetch everything with the new token (drops any stale/anon cache).
    await qc.invalidateQueries();
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
    setUsername(null);
    qc.clear();
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: authed, isLoading: meQuery.isLoading, username, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
