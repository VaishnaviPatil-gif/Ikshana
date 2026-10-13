import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    if (token) {
      authAPI.getMe()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      // Try to load from localStorage
      const stored = localStorage.getItem('user');
      if (stored) {
        try { setUser(JSON.parse(stored)); } catch {}
      }
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username, password) => {
    const res = await authAPI.login(username, password);
    const { access_token, role, username: uname } = res.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    // Fetch full user
    const meRes = await authAPI.getMe();
    setUser(meRes.data);
    localStorage.setItem('user', JSON.stringify(meRes.data));
    return meRes.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!user && !!token;

  const getDashboardPath = useCallback(() => {
    if (!user) return '/login';
    switch (user.role) {
      case 'coast_guard': return '/dashboard/coastguard';
      case 'regional_manager': return '/dashboard/regional';
      case 'higher_authority': return '/dashboard/authority';
      default: return '/';
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthenticated,
      login, logout, getDashboardPath,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
