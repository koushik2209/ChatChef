import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Seller } from '../types';

interface AuthCtx {
  token: string | null;
  seller: Seller | null;
  isAuthenticated: boolean;
  login: (token: string, seller: Seller) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [seller, setSeller] = useState<Seller | null>(() => {
    try {
      const s = localStorage.getItem('seller');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  function login(newToken: string, newSeller: Seller) {
    setToken(newToken);
    setSeller(newSeller);
    localStorage.setItem('token', newToken);
    localStorage.setItem('seller', JSON.stringify(newSeller));
  }

  function logout() {
    setToken(null);
    setSeller(null);
    localStorage.removeItem('token');
    localStorage.removeItem('seller');
  }

  return (
    <AuthContext.Provider value={{ token, seller, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
