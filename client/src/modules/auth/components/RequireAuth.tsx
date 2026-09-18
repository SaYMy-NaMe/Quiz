import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Spinner } from '@/components/Spinner';

/** Route guard: redirects anonymous visitors to /login, preserving the target. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const location = useLocation();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'idle' || status === 'loading') return <Spinner label="Checking session…" fullscreen />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Inverse guard for /login and /register: authenticated users go to the dashboard. */
export function RedirectIfAuthenticated() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'idle' || status === 'loading') return <Spinner label="Loading…" fullscreen />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
