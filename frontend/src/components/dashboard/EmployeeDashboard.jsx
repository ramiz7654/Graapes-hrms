import DashboardPage from './DashboardPage.jsx';
import { BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ClipboardList, Clock3, FileBarChart, FolderLock, Megaphone, Network, Plane, ScrollText, Settings, ShieldCheck, UserCheck, Users } from 'lucide-react';

const config = {
 eyebrow: "EMPLOYEE", title: "My workspace", subtitle: "Your personal attendance, leave, documents and workplace updates in one place.",
 stats: [{ label: "My attendance", note: "Current records", icon: Users },
{ label: "Available leave balance", note: "Today\u2019s summary", icon: Building2 },
{ label: "Pending requests", note: "Needs attention", icon: UserCheck },
{ label: "Next holiday", note: "Requires review", icon: Clock3 }],
 actions: [{ label: "My attendance", to: "/attendance", icon: Users },
{ label: "Apply for leave", to: "/leave", icon: CalendarCheck },
{ label: "Announcements", to: "/announcements", icon: Plane }],
 sections: [{ title: "Self-service", items: [{ title: "My profile", description: "View your own profile and job details" },{ title: "My attendance", description: "Check attendance history, working hours and corrections" },{ title: "Apply for leave", description: "Apply for leave and track approval status" }] }, { title: "Workplace information", items: [{ title: "My profile", description: "View your leave balance and applicable holiday calendar" },{ title: "My attendance", description: "Access documents shared with you" },{ title: "Apply for leave", description: "Read company announcements and policy updates" }] }]
};
export default function EmployeeDashboard() { return <DashboardPage config={config} />; }
