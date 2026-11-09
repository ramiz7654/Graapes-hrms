import {
  LayoutDashboard,
  Users,
  Network,
  CalendarCheck,
  Plane,
  CalendarDays,
  Megaphone,
  FolderLock,
  BarChart3,
  ScrollText,
  Settings,
  Activity,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

const createCommonNavigation = (dashboardPath) => [
  {
    to: dashboardPath,
    label: 'Dashboard',
    icon: LayoutDashboard,
    built: true,
  },
  {
    to: '/profile',
    label: 'My Profile',
    icon: UserRound,
    built: true,
  },
];

export const ROLE_NAV = {
  '/dashboard/super-admin': [
    ...createCommonNavigation('/dashboard/super-admin'),
    { to: '/organization', label: 'Organization', icon: Network },
    { to: '/holidays', label: 'Holiday calendar', icon: CalendarDays },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/employees', label: 'Employee directory', icon: Users },
    { to: '/attendance', label: 'Attendance overview', icon: CalendarCheck },
    { to: '/leave', label: 'Leave overview', icon: Plane },
    { to: '/reports', label: 'Organization reports', icon: BarChart3 },
    { to: '/admin', label: 'User Management & Roles', icon: ShieldCheck },
    { to: '/audit', label: 'Audit logs', icon: ScrollText },
    { to: '/settings', label: 'System settings', icon: Settings },
    { to: '/status', label: 'System status', icon: Activity, built: true },
  ],

  '/dashboard/hr-admin': [
    ...createCommonNavigation('/dashboard/hr-admin'),
    { to: '/employees', label: 'Employee directory', icon: Users },
    { to: '/organization', label: 'Organization', icon: Network },
    { to: '/attendance', label: 'Attendance overview', icon: CalendarCheck },
    { to: '/leave', label: 'Leave overview', icon: Plane },
    { to: '/holidays', label: 'Holiday calendar', icon: CalendarDays },
    { to: '/documents', label: 'Employee documents', icon: FolderLock },
    { to: '/reports', label: 'Organization reports', icon: BarChart3 },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/status', label: 'System status', icon: Activity, built: true },
  ],

  '/dashboard/manager': [
    ...createCommonNavigation('/dashboard/manager'),
    { to: '/employees', label: 'My Team', icon: Users },
    { to: '/attendance', label: 'Team attendance', icon: CalendarCheck },
    { to: '/leave', label: 'Leave Approvals', icon: Plane },
    { to: '/holidays', label: 'Team calendar', icon: CalendarDays },
    { to: '/reports', label: 'Team reports', icon: BarChart3 },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/status', label: 'System status', icon: Activity, built: true },
  ],

  '/dashboard/employee': [
    ...createCommonNavigation('/dashboard/employee'),
    { to: '/attendance', label: 'My attendance', icon: CalendarCheck },
    { to: '/leave', label: 'My leave & requests', icon: Plane },
    { to: '/documents', label: 'My documents', icon: FolderLock },
    { to: '/holidays', label: 'Holiday calendar', icon: CalendarDays },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/settings', label: 'My settings', icon: Settings },
    { to: '/status', label: 'System status', icon: Activity, built: true },
  ],
};

export const NAV_ITEMS = ROLE_NAV['/dashboard/super-admin'];