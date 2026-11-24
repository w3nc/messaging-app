import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearStoredToken, getStoredToken, storeToken } from './api.js';

// Keeps the signed-in user, or null for guests. "Stay logged out" = guest mode (read-only).
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!getStoredToken()) {
        setReady(true);
        return;
      }
      try {
        const data = await api.me();
        if (alive) setUser(data.user);
      } catch {
        clearStoredToken();
      } finally {
        if (alive) setReady(true);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (body) => {
    const data = await api.login(body);
    storeToken(data.token, body.remember);
    setUser(data.user);
    return data.user;
  }, []);

  const signUp = useCallback(async (body) => {
    const data = await api.signup(body);
    storeToken(data.token, true);
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Even if the server is unreachable, clear this browser.
    }
    clearStoredToken();
    setUser(null);
  }, []);

  const continueAsGuest = useCallback(async () => {
    const data = await api.continueAsGuest();
    storeToken(data.token, false);
    setUser(data.user);
    return data.user;
  }, []);

  const updateUser = useCallback((next) => setUser(next), []);

  // A visitor is a real account with isGuest set: they can chat, but not edit a profile.
  const guest = Boolean(user && user.isGuest);

  const value = useMemo(
    () => ({ user, guest, ready, signIn, signUp, signOut, continueAsGuest, updateUser }),
    [user, guest, ready, signIn, signUp, signOut, continueAsGuest, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
