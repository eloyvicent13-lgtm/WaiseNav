import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginRequest, registerRequest, TOKEN_KEY } from '../services/api';

type User = { id: string; email: string; name: string | null };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session restore is intentionally minimal: presence of a stored token
    // just unlocks the app shell; /auth/me can re-validate lazily on first
    // authenticated request. Timeout-guarded: a native call that never
    // settles must not leave `loading` true forever.
    Promise.race([
      SecureStore.getItemAsync(TOKEN_KEY),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await loginRequest(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setUser(data.user);
  }

  async function register(email: string, password: string, name?: string) {
    const data = await registerRequest(email, password, name);
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setUser(data.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
