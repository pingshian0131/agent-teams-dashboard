import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'dashboard_auth_token';

interface UseAuthResult {
  token: string | null;
  needsAuth: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
}

export function useAuth(): UseAuthResult {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [needsAuth, setNeedsAuth] = useState(false);

  // Check if server requires auth by probing /api/snapshot
  useEffect(() => {
    fetch('/api/snapshot', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((res) => {
      if (res.status === 401) {
        setNeedsAuth(true);
      } else {
        setNeedsAuth(false);
      }
    }).catch(() => {
      // Network error — don't show login screen
    });
  }, [token]);

  // Listen for 401 events from WebSocket or fetch
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(STORAGE_KEY);
      setTokenState(null);
      setNeedsAuth(true);
    };
    window.addEventListener('auth-required', handler);
    return () => window.removeEventListener('auth-required', handler);
  }, []);

  const setToken = useCallback((t: string) => {
    localStorage.setItem(STORAGE_KEY, t);
    setTokenState(t);
    setNeedsAuth(false);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTokenState(null);
    setNeedsAuth(true);
  }, []);

  return { token, needsAuth, setToken, clearToken };
}
