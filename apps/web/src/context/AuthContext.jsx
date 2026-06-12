import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api, setAuthToken } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("myos-token"));
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkSetup = useCallback(async () => {
    try {
      const res = await api.get("/settings/setup-status");
      return res.data.needsSetup;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const setupNeeded = await checkSetup();
      if (cancelled) return;

      if (setupNeeded) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      setAuthToken(token);

      if (!token) {
        setNeedsSetup(false);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        if (!cancelled) {
          setNeedsSetup(false);
          setUser(response.data.user);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("myos-token");
          setToken(null);
          setAuthToken(null);
          setNeedsSetup(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, checkSetup]);

  const value = useMemo(() => ({
    token,
    user,
    needsSetup,
    loading,
    checkSetup,
    async login(username, password) {
      const response = await api.post("/auth/login", { username, password });
      localStorage.setItem("myos-token", response.data.token);
      setAuthToken(response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
    },
    async logout() {
      await api.post("/auth/logout").catch(() => null);
      localStorage.removeItem("myos-token");
      setAuthToken(null);
      setToken(null);
      setUser(null);
    }
  }), [token, user, needsSetup, loading, checkSetup]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
