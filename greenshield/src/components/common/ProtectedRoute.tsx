import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/types';
import { useAuth } from '@/lib/auth';
import { homeForRole, ROUTES } from '@/lib/routes';

export function RequireAuth() {
  const token = useAuth((s) => s.token);
  const loc = useLocation();
  if (!token) return <Navigate to={ROUTES.login} state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to={ROUTES.login} replace />;
  if (!roles.includes(user.role) && user.role !== 'admin') return <Navigate to={homeForRole(user.role)} replace />;
  return <Outlet />;
}
