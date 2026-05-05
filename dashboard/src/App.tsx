import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import CookingSummary from './pages/CookingSummary';
import Payments from './pages/Payments';

function Guard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/"         element={<Guard><Home /></Guard>} />
        <Route path="/orders"  element={<Guard><Orders /></Guard>} />
        <Route path="/menu"    element={<Guard><Menu /></Guard>} />
        <Route path="/cooking" element={<Guard><CookingSummary /></Guard>} />
        <Route path="/payments"element={<Guard><Payments /></Guard>} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}
