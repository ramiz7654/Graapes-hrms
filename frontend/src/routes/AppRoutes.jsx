import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from '../layouts/AppShell.jsx';
import StatusPage from '../features/status/StatusPage.jsx';

import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard.jsx';
import HRAdminDashboard from '../components/dashboard/HRAdminDashboard.jsx';
import ManagerDashboard from '../components/dashboard/ManagerDashboard.jsx';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard.jsx';

import ComingSoon from '../features/placeholder/ComingSoon.jsx';
import EmployeeFeaturePage from '../features/placeholder/EmployeeFeaturePage.jsx';

import Login from '../pages/Login.jsx';
import ResetPassword from '../pages/ResetPassword.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import MyAttendance from '../features/attendance/MyAttendance.jsx';
import LeaveManagement from '../features/leave/LeaveManagement.jsx';
import EmployeeDirectory from '../features/employees/EmployeeDirectory.jsx';
import EmployeeProfile from '../features/employees/EmployeeProfile.jsx';
import OrganizationPage from '../features/organization/OrganizationPage.jsx';
import HolidaysPage from '../features/holidays/HolidaysPage.jsx';
import AnnouncementsPage from '../features/announcements/AnnouncementsPage.jsx';
import DocumentsPage from '../features/documents/DocumentsPage.jsx';
import AuditLogsPage from '../features/audit/AuditLogsPage.jsx';
import ReportsPage from '../features/reports/ReportsPage.jsx';
import SettingsPage from '../features/settings/SettingsPage.jsx';

import { ROLE_NAV } from '../app/navigation.js';
import { ShieldCheck } from 'lucide-react';
import { AuthGuard } from '../auth/AuthGuard.jsx';
import { useAuth } from '../app/AuthContext.jsx';

// Dedicated functional pages list to avoid duplicate catch-all routes
const DEDICATED_PATHS = [
  '/',
  '/login',
  '/reset-password',
  '/attendance',
  '/leave',
  '/employees',
  '/organization',
  '/holidays',
  '/announcements',
  '/documents',
  '/audit',
  '/reports',
  '/settings',
  '/profile',
  '/status',
  '/dashboard/super-admin',
  '/dashboard/hr-admin',
  '/dashboard/manager',
  '/dashboard/employee',
  '/admin',
];

const REMAINING_NAV_ITEMS = [
  ...new Map(
    Object.values(ROLE_NAV)
      .flat()
      .filter((item) => !DEDICATED_PATHS.includes(item.to))
      .map((item) => [item.to, item])
  ).values(),
];

function RoleAwareFeature({ item }) {
  const { user } = useAuth();
  const role = String(user?.role || '').trim().toUpperCase().replace(/[ -]/g, '_');

  const isEmployeeSelfService =
    ['EMPLOYEE', 'INTERN', 'EMPLOYEE_INTERN'].includes(role) ||
    role.includes('EMPLOYEE') ||
    role.includes('INTERN');

  const selfServicePaths = ['/settings'];

  if (isEmployeeSelfService && selfServicePaths.includes(item.to)) {
    return <EmployeeFeaturePage path={item.to} />;
  }

  return <ComingSoon item={item} />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root and login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected application layout */}
      <Route element={<AppShell />}>
        {/* Core Dedicated Features */}
        <Route
          path="/attendance"
          element={
            <AuthGuard>
              <MyAttendance />
            </AuthGuard>
          }
        />

        <Route
          path="/leave"
          element={
            <AuthGuard>
              <LeaveManagement />
            </AuthGuard>
          }
        />

        <Route
          path="/employees"
          element={
            <AuthGuard>
              <EmployeeDirectory />
            </AuthGuard>
          }
        />

        <Route
          path="/organization"
          element={
            <AuthGuard>
              <OrganizationPage />
            </AuthGuard>
          }
        />

        <Route
          path="/holidays"
          element={
            <AuthGuard>
              <HolidaysPage />
            </AuthGuard>
          }
        />

        <Route
          path="/announcements"
          element={
            <AuthGuard>
              <AnnouncementsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/documents"
          element={
            <AuthGuard>
              <DocumentsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/audit"
          element={
            <AuthGuard roles={['SUPER_ADMIN', 'HR_ADMIN']}>
              <AuditLogsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/reports"
          element={
            <AuthGuard roles={['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']}>
              <ReportsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/settings"
          element={
            <AuthGuard>
              <SettingsPage />
            </AuthGuard>
          }
        />

        <Route
          path="/profile"
          element={
            <AuthGuard>
              <ProfilePage />
            </AuthGuard>
          }
        />

        <Route
          path="/status"
          element={
            <AuthGuard>
              <StatusPage />
            </AuthGuard>
          }
        />

        {/* Super Admin dashboard */}
        <Route
          path="/dashboard/super-admin"
          element={
            <AuthGuard roles={['SUPER_ADMIN']}>
              <SuperAdminDashboard />
            </AuthGuard>
          }
        />

        {/* HR Admin dashboard */}
        <Route
          path="/dashboard/hr-admin"
          element={
            <AuthGuard roles={['HR_ADMIN']}>
              <HRAdminDashboard />
            </AuthGuard>
          }
        />

        {/* Manager dashboard */}
        <Route
          path="/dashboard/manager"
          element={
            <AuthGuard roles={['MANAGER']}>
              <ManagerDashboard />
            </AuthGuard>
          }
        />

        {/* Employee dashboard */}
        <Route
          path="/dashboard/employee"
          element={
            <AuthGuard roles={['EMPLOYEE', 'INTERN']}>
              <EmployeeDashboard />
            </AuthGuard>
          }
        />

        {/* Full profile of one employee (server decides who may view whom) */}
        <Route
          path="/employees/:id"
          element={
            <AuthGuard roles={['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']}>
              <EmployeeProfile />
            </AuthGuard>
          }
        />

        {/* Super Admin User Management route */}
        <Route
          path="/admin"
          element={
            <AuthGuard roles={['SUPER_ADMIN']}>
              <EmployeeDirectory />
            </AuthGuard>
          }
        />

        {/* Fallback navigation for remaining items like /reports, /settings */}
        {REMAINING_NAV_ITEMS.map((item) => (
          <Route
            key={item.to}
            path={item.to}
            element={
              <AuthGuard>
                <RoleAwareFeature item={item} />
              </AuthGuard>
            }
          />
        ))}

        {/* Unknown routes fallback to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
