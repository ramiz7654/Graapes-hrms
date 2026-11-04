import DashboardPage from './DashboardPage.jsx';
import { BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ClipboardList, Clock3, FileBarChart, FolderLock, Megaphone, Network, Plane, ScrollText, Settings, ShieldCheck, UserCheck, Users } from 'lucide-react';

const config = {
 eyebrow: "SUPER ADMIN", title: "Organization control center", subtitle: "Monitor organization setup, user access and system-wide workforce operations.",
 stats: [{ label: "Total employees", note: "Current records", icon: Users },
{ label: "Departments", note: "Today\u2019s summary", icon: Building2 },
{ label: "Active user accounts", note: "Needs attention", icon: UserCheck },
{ label: "Pending admin issues", note: "Requires review", icon: Clock3 }],
 actions: [{ label: "Employee directory", to: "/employees", icon: Users },
{ label: "Organization setup", to: "/organization", icon: CalendarCheck },
{ label: "Audit logs", to: "/audit", icon: Plane }],
 sections: [{ title: "Organization & people", items: [{ title: "Employee directory", description: "Company profile, branches and departments" },{ title: "Organization structure", description: "Employee headcount and employment status" },{ title: "User & role management", description: "Reporting lines and designations" }] }, { title: "Security & governance", items: [{ title: "Employee directory", description: "Create and deactivate user accounts" },{ title: "Organization structure", description: "Assign roles and review permissions" },{ title: "User & role management", description: "Review audit events and system configuration" }] }]
};
export default function SuperAdminDashboard() { return <DashboardPage config={config} />; }
