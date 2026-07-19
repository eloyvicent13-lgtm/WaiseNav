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
    // BISECTION: SecureStore.getItemAsync() temporarily disabled here.
    // Two builds in a row crashed at launch with an identical RCTFatal
    // signature (native-module-callback exception) even after adding
    // .catch()+timeout around this call — meaning either that guard has a
    // gap or this was never the actual cause. Removing it entirely as a
    // single-variable test: if the crash stops, SecureStore is confirmed;
    // if it doesn't, look elsewhere (react-navigation/react-native-screens
    // native init, which also runs unconditionally at launch).
    setLoading(false);
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
