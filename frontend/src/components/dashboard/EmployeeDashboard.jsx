import DashboardPage from './DashboardPage.jsx';
import { CalendarCheck, CalendarDays, Clock3, Plane } from 'lucide-react';

const config = {
  role: 'EMPLOYEE',
  eyebrow: 'EMPLOYEE',
  title: 'My workspace',
  subtitle: 'Your attendance, leave and company updates in one place.',
  stats: [
    { key: 'monthlyAttendance', label: 'Days worked this month', icon: CalendarCheck, note: 'Present and late days' },
    { key: 'leaveBalance', label: 'Available leave balance', icon: Plane, format: 'days', note: 'Days remaining across leave types' },
    { key: 'requestsInProgress', label: 'Pending requests', icon: Clock3, note: 'Waiting for approval' },
    { key: 'nextHoliday', label: 'Next holiday', icon: CalendarDays, note: (s) => (s?.nextHolidayDate ? new Date(s.nextHolidayDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', timeZone: 'UTC' }) : 'No holiday scheduled') },
  ],
};

export default function EmployeeDashboard() {
  return <DashboardPage config={config} />;
}
