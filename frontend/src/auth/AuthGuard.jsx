import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

const roleHomes = {
  SUPER_ADMIN: '/dashboard/super-admin',
  HR_ADMIN: '/dashboard/hr-admin',
  MANAGER: '/dashboard/manager',
  EMPLOYEE: '/dashboard/employee',
  INTERN: '/dashboard/employee',
  EMPLOYEE_INTERN: '/dashboard/employee',
  FINANCE: '/dashboard/super-admin',
};

export function AuthGuard({ children, roles }) {
  const [state, setState] = useState({ loading: true, user: null });
  const location = useLocation();
  useEffect(() => {
    let alive = true;
    api('/auth/me').then(({ user }) => { if (alive) setState({ loading: false, user }); })
      .catch(() => { if (alive) setState({ loading: false, user: null }); });
    return () => { alive = false; };
  }, []);
  if (state.loading) return <main className="min-h-screen grid place-items-center text-sm text-muted">Checking your session…</main>;
  if (!state.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(state.user.role)) return <Navigate to={roleHomes[state.user.role] || '/login'} replace />;
  return children;
}

export function dashboardForRole(role) {
  return roleHomes[role] || '/login';
}
