import DashboardPage from './DashboardPage.jsx';
import { BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ClipboardList, Clock3, FileBarChart, FolderLock, Megaphone, Network, Plane, ScrollText, Settings, ShieldCheck, UserCheck, Users } from 'lucide-react';

const config = {
 eyebrow: "MANAGER", title: "My team dashboard", subtitle: "See your assigned team, attendance exceptions and approvals that need your attention.",
 stats: [{ label: "My team members", note: "Current records", icon: Users },
{ label: "Present today", note: "Today\u2019s summary", icon: Building2 },
{ label: "Pending approvals", note: "Needs attention", icon: UserCheck },
{ label: "Upcoming team leave", note: "Requires review", icon: Clock3 }],
 actions: [{ label: "My team", to: "/employees", icon: Users },
{ label: "Team attendance", to: "/attendance", icon: CalendarCheck },
{ label: "Pending leave", to: "/leave", icon: Plane }],
 sections: [{ title: "Team overview", items: [{ title: "My team", description: "View employees assigned to your team only" },{ title: "Team attendance", description: "Review daily attendance and working hours" },{ title: "Leave approvals", description: "See approved leave and upcoming team absences" }] }, { title: "Manager actions", items: [{ title: "My team", description: "Approve or decline assigned team leave requests" },{ title: "Team attendance", description: "Review attendance correction requests" },{ title: "Leave approvals", description: "View team-level reports and attendance exceptions" }] }]
};
export default function ManagerDashboard() { return <DashboardPage config={config} />; }
