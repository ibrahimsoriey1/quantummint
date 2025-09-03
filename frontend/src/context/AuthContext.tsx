import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

type User = { id: string; email: string; name?: string; role?: string } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  login: (email: string, password: string) => Promise<'ok' | '2fa' | 'error'>;
  verify2fa: (code: string) => Promise<boolean>;
  register: (payload: { name?: string; email: string; password: string }) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [pending2FA, setPending2FA] = useState<{ tempToken?: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get('/api/v1/users/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password });
      if (data?.twoFactorRequired && data?.tempToken) {
        setPending2FA({ tempToken: data.tempToken });
        return '2fa';
      }
      if (data?.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        return 'ok';
      }
      return 'error';
    } catch {
      return 'error';
    }
  };

  const verify2fa = async (code: string) => {
    try {
      const { data } = await api.post('/api/v1/2fa/verify', { code, tempToken: pending2FA?.tempToken });
      if (data?.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setPending2FA(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const register = async (payload: { name?: string; email: string; password: string }) => {
    try {
      await api.post('/api/v1/auth/register', payload);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const value = useMemo(() => ({ user, token, login, verify2fa, register, logout }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


