import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/AuthContext';
import { useTheme } from './lib/ThemeContext';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Users from './pages/Users';
import Settings from './pages/Settings';
import ServerDetail from './pages/ServerDetail';
import TestAnimation from './pages/TestAnimation';
import Wizard from './pages/Wizard';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { theme, loading: themeLoading } = useTheme();
  const location = useLocation();
  if (loading || themeLoading) return <div className="min-h-screen flex items-center justify-center text-text-secondary text-[13px]">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!theme.setupComplete && location.pathname !== '/setup') return <Navigate to="/setup" replace />;
  return <Layout><PageTransition>{children}</PageTransition></Layout>;
}

function RequireAuthOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-text-secondary text-[13px]">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/test-animation" element={<TestAnimation />} />
        <Route path="/setup" element={<RequireAuthOnly><Wizard /></RequireAuthOnly>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/templates" element={<RequireAuth><Templates /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><Users /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/servers/:id/*" element={<RequireAuth><ServerDetail /></RequireAuth>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
