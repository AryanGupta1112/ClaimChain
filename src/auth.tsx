import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { AuthUser, Capability } from "../shared/auth";
import { hasCapability } from "../shared/auth";
import { api, storage } from "./lib";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  can: (capability: Capability) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: AuthUser }>("/auth/me");
      setUser(result.user);
      return result.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const clear = () => setUser(null);
    window.addEventListener("claimchain:unauthenticated", clear);
    return () =>
      window.removeEventListener("claimchain:unauthenticated", clear);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      signOut: async () => {
        await api("/auth/logout", "POST");
        // Recovered drafts and view preferences are per-viewer state. Signing
        // out on a shared counter machine must not leave them for the next
        // person. An expired session deliberately does not clear them, so
        // unsaved work survives signing back in.
        storage.clearAll();
        setUser(null);
      },
      can: (capability) => Boolean(user && hasCapability(user, capability)),
    }),
    [loading, refresh, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Authentication unavailable");
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="boot-screen" aria-live="polite">
        <div className="wordmark">
          ClaimChain<span>.</span>
        </div>
        <div className="workspace-loader" aria-hidden="true">
          <span />
        </div>
        <span className="muted">Securing your workspace...</span>
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  return children;
}

export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return can(capability) ? children : <Navigate to="/unauthorized" replace />;
}
