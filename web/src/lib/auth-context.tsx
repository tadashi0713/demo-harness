'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api';
import type { User } from './types';

type AuthState = {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  // 起動時に localStorage のトークンを検証してセッションを復元する
  useEffect(() => {
    let cancelled = false;

    if (!tokenStore.get()) {
      setStatus('anonymous');
      return;
    }

    api
      .me()
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        tokenStore.clear();
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: signedIn } = await api.login(email, password);
      tokenStore.set(token);
      setUser(signedIn);
      setStatus('authenticated');
      router.push('/dashboard');
    },
    [router],
  );

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string }) => {
      const { token, user: created } = await api.register(input);
      tokenStore.set(token);
      setUser(created);
      setStatus('authenticated');
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth は AuthProvider の内側で使ってください');
  return context;
}
