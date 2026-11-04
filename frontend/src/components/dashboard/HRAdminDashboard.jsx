import DashboardPage from './DashboardPage.jsx';
import { Building2, CalendarCheck, Clock3, UserCheck, Users } from 'lucide-react';

const config = {
  eyebrow: 'HR ADMIN',
  title: 'HR operations dashboard',
  subtitle: 'A clear overview of your workforce, today’s attendance and pending HR work.',
  showQuickActions: false,
  showWorkforceCharts: true,
  stats: [
    { label: 'Employees', note: 'Active employee records', icon: Users },
    { label: 'Present today', note: 'Present and late records', icon: UserCheck },
    { label: 'Pending leave requests', note: 'Awaiting HR review', icon: Clock3 },
    { label: 'Departments', note: 'Active departments', icon: Building2 },
  ],
  sections: [
    { title: 'People management', items: [
      { title: 'Employee directory', description: 'View and maintain employee profiles, department and reporting details.' },
      { title: 'Organization structure', description: 'Manage departments, designations and reporting relationships.' },
      { title: 'Employee lifecycle', description: 'Track active employee records and account status.' },
    ] },
    { title: 'Attendance and approvals', items: [
      { title: 'Daily attendance', description: 'Review recorded check-ins, check-outs and attendance exceptions.' },
      { title: 'Leave requests', description: 'Review pending requests and follow configured leave policies.' },
      { title: 'Reports and holidays', description: 'Review workforce summaries and upcoming published holidays.' },
    ] },
  ],
};

export default function HRAdminDashboard() {
  return <DashboardPage config={config} />;
}
