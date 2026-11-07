import DashboardPage from './DashboardPage.jsx';
import { Building2, Clock3, UserCheck, Users } from 'lucide-react';

const config = {
  role: 'HR_ADMIN',
  eyebrow: 'HR ADMIN',
  title: 'HR operations dashboard',
  subtitle: 'A company-wide overview of your workforce, today’s attendance and pending HR work.',
  stats: [
    { key: 'totalEmployees', label: 'Employees', icon: Users, note: 'Active employees across the company' },
    { key: 'presentToday', label: 'Present today', icon: UserCheck, note: 'Present and late check-ins' },
    { key: 'pendingLeaves', label: 'Pending leave requests', icon: Clock3, note: (s) => `${s?.pendingCorrections ?? 0} attendance corrections also pending` },
    { key: 'departments', label: 'Departments', icon: Building2, note: 'Active departments' },
  ],
};

export default function HRAdminDashboard() {
  return <DashboardPage config={config} />;
}
