import DashboardPage from './DashboardPage.jsx';
<<<<<<< Updated upstream
import { Building2, ClipboardList, UserCheck, Users } from 'lucide-react';
=======
import { Briefcase, Building2, ClipboardList, UserCheck, Users } from 'lucide-react';
>>>>>>> Stashed changes

const config = {
  role: 'SUPER_ADMIN',
  eyebrow: 'SUPER ADMIN',
  title: 'Organization control center',
  subtitle: 'Monitor your workforce, attendance, approvals and company calendar in one place.',
  stats: [
    { key: 'totalEmployees', label: 'Total employees', icon: Users, note: (s) => `${s?.presentToday ?? 0} present today` },
    { key: 'departments', label: 'Departments', icon: Building2, note: 'Active departments' },
<<<<<<< Updated upstream
=======
    { key: 'designations', label: 'Designations', icon: Briefcase, note: 'Active designations' },
>>>>>>> Stashed changes
    { key: 'activeAccounts', label: 'Active user accounts', icon: UserCheck, note: 'Accounts that can sign in' },
    { key: 'pendingAdminIssues', label: 'Pending approvals', icon: ClipboardList, note: 'Leave and attendance corrections' },
  ],
};

export default function SuperAdminDashboard() {
  return <DashboardPage config={config} />;
}
