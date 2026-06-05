import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMe, loginUser, registerUser, logoutUser, updateProfile } from '../api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'authToken';

function migrateLegacyToken() {
  const legacy = localStorage.getItem('adminToken');
  if (legacy && !localStorage.getItem(TOKEN_KEY)) {
    localStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem('adminToken');
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    migrateLegacyToken();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await fetchMe();
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { token, user: u } = await loginUser(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  };

  const register = async (data) => {
    const { token, user: u } = await registerUser(data);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  };

  const saveProfile = async (data) => {
    const { user: u } = await updateProfile(data);
    setUser(u);
    return u;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('adminToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, saveProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
