'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import { authService } from '@/services/auth.service';
import { AuthUser } from '@/types';

interface AuthContextType {
  user:           AuthUser | null;
  loading:        boolean;
  login:          (email: string, password: string) => Promise<AuthUser>;
  logout:         () => Promise<void>;
  refreshUser:    () => Promise<void>;
  updateUserName: (name: string) => void;
  isLoggedIn:     boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = Cookies.get('access_token');
    if (!token) { setLoading(false); return; }
    try {
      const me = await authService.me();
      setUser(me);
    } catch {
      Cookies.remove('access_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const result = await authService.login(email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authService.me();
      setUser(me);
    } catch { /* silent */ }
  }, []);

  const updateUserName = useCallback((name: string) => {
    setUser(prev => prev ? { ...prev, name } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, updateUserName, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
