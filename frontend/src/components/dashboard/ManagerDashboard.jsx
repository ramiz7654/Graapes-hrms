import DashboardPage from './DashboardPage.jsx';
import { Clock3, Plane, UserCheck, Users } from 'lucide-react';

const config = {
  role: 'MANAGER',
  eyebrow: 'MANAGER',
  title: 'My team dashboard',
  subtitle: 'See your team’s attendance, who is on leave and the approvals that need your attention.',
  stats: [
    { key: 'teamMembers', label: 'My team members', icon: Users, note: 'People reporting to you' },
    { key: 'teamPresentToday', label: 'Present today', icon: UserCheck, note: 'Present and late check-ins' },
    { key: 'pendingApprovals', label: 'Pending approvals', icon: Clock3, note: 'Leave and attendance corrections' },
    { key: 'upcomingTeamLeave', label: 'Upcoming team leave', icon: Plane, note: 'Approved leave still to come' },
  ],
};

export default function ManagerDashboard() {
  return <DashboardPage config={config} />;
}
