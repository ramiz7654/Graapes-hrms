import { useMemo, useState } from 'react';
import {
  Users, UserCheck, CalendarCheck, Plane, Clock3, ClipboardList,
  ArrowUpRight, ArrowRight, CalendarDays, Megaphone, ShieldCheck,
  BriefcaseBusiness, FileBarChart, CircleCheck, AlertCircle, Wallet,
} from 'lucide-react';

const ROLES = [
  { id: 'SUPER_ADMIN', label: 'Super Admin', note: 'Company-wide access' },
  { id: 'HR_ADMIN', label: 'HR Admin', note: 'People & HR operations' },
  { id: 'MANAGER', label: 'Manager', note: 'Assigned team only' },
  { id: 'EMPLOYEE', label: 'Employee', note: 'Personal workspace' },
];

const CONFIG = {
  SUPER_ADMIN: {
    title: 'Company overview', subtitle: 'A high-level view of people and workplace operations.',
    stats: [
      ['Total employees', '—', 'Active employee records', Users],
      ['Present today', '—', 'Attendance summary', UserCheck],
      ['Pending leave requests', '—', 'Across the organization', Plane],
      ['Departments', '—', 'Configured departments', BriefcaseBusiness],
    ],
    sections: [
      { title: 'People overview', icon: Users, items: [['Employee directory', 'Manage employee records and employment details'], ['Organization structure', 'Departments, designations and reporting lines'], ['User access & roles', 'Review accounts and role assignments']] },
      { title: 'Operations & governance', icon: ShieldCheck, items: [['Attendance & leave', 'Organization-wide attendance and leave activity'], ['Reports & exports', 'Authorized workforce summaries and reports'], ['Audit activity', 'Review important administrative actions']] },
    ],
    actions: [['User management', Users, '/admin'], ['Review leave', Plane, '/leave'], ['Open reports', FileBarChart, '/reports']],
  },
  HR_ADMIN: {
    title: 'HR operations', subtitle: 'Keep employee records, attendance and people processes moving.',
    stats: [
      ['Employees', '—', 'Employee directory', Users],
      ['Present today', '—', 'Attendance overview', UserCheck],
      ['Leave requests', '—', 'Awaiting HR review', Plane],
      ['Upcoming holidays', '—', 'Published holiday calendar', CalendarDays],
    ],
    sections: [
      { title: 'People management', icon: Users, items: [['Employee records', 'Create and maintain employee profiles'], ['Onboarding checklist', 'Track joining details and required documents'], ['Departments & designations', 'Maintain organization information']] },
      { title: 'Daily HR workflow', icon: ClipboardList, items: [['Attendance exceptions', 'Review missing punches and correction requests'], ['Leave administration', 'Review requests and leave balances'], ['HR reports', 'Prepare workforce summaries and exports']] },
    ],
    actions: [['Employee directory', Users, '/employees'], ['Review leave', Plane, '/leave'], ['Attendance', CalendarCheck, '/attendance']],
  },
  MANAGER: {
    title: 'Team dashboard', subtitle: 'A focused view of your assigned team and pending decisions.',
    stats: [
      ['Team members', '—', 'Assigned direct reports', Users],
      ['Present today', '—', 'Team attendance', UserCheck],
      ['Pending approvals', '—', 'Leave and attendance requests', ClipboardList],
      ['Upcoming team leave', '—', 'Approved leave calendar', CalendarDays],
    ],
    sections: [
      { title: 'My team', icon: Users, items: [['Team directory', 'View permitted details for assigned team members'], ['Attendance exceptions', 'Spot missing check-ins and attendance issues'], ['Team calendar', 'See approved leave and upcoming holidays']] },
      { title: 'Approvals', icon: CircleCheck, items: [['Leave decisions', 'Review and decide team leave requests'], ['Attendance corrections', 'Review correction requests from your team'], ['Team summaries', 'View authorized team-level reports']] },
    ],
    actions: [['Pending leave', Plane, '/leave'], ['Team attendance', CalendarCheck, '/attendance'], ['Team members', Users, '/employees']],
  },
  EMPLOYEE: {
    title: 'My workspace', subtitle: 'Your attendance, leave and important workplace updates in one place.',
    stats: [
      ['Attendance this month', '—', 'Your recorded attendance', CalendarCheck],
      ['Leave balance', '—', 'Available balance', Plane],
      ['Requests in progress', '—', 'Your pending requests', Clock3],
      ['Next holiday', '—', 'From the published calendar', CalendarDays],
    ],
    sections: [
      { title: 'My details', icon: Users, items: [['My profile', 'Review your personal and job information'], ['My attendance', 'View your own attendance records'], ['My leave', 'Check balance and track leave requests']] },
      { title: 'Workplace updates', icon: Megaphone, items: [['Announcements', 'Company updates and notices'], ['Holidays', 'Upcoming company holidays'], ['My documents', 'Access documents made available to you']] },
    ],
    actions: [['View attendance', CalendarCheck, '/attendance'], ['Apply for leave', Plane, '/leave'], ['Announcements', Megaphone, '/announcements']],
  },
};

function StatCard({ stat }) {
  const [label, value, detail, Icon] = stat;
  return <article className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={19} /></span><span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-muted">Live data pending</span></div>
    <p className="mt-4 text-sm text-muted">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p>
  </article>;
}

export default function DashboardPage() {
  const [role, setRole] = useState('SUPER_ADMIN');
  const config = useMemo(() => CONFIG[role], [role]);
  const activeRole = ROLES.find((r) => r.id === role);
  return <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Dashboard preview</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{config.title}</h2><p className="mt-2 max-w-2xl text-sm text-muted">{config.subtitle}</p></div>
        <div className="w-full lg:max-w-xs"><label htmlFor="role-preview" className="mb-1.5 block text-xs font-semibold text-muted">Preview dashboard as</label><select id="role-preview" value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-text outline-none focus:ring-2 focus:ring-accent">{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.note}</option>)}</select><p className="mt-1.5 text-[11px] text-muted">Preview only; this selector does not change login permissions.</p></div>
      </div>
    </section>

    <section aria-label="Dashboard summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{config.stats.map((stat) => <StatCard key={stat[0]} stat={stat} />)}</section>

    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold">Quick actions</h3><p className="mt-1 text-xs text-muted">Shortcuts relevant to {activeRole.label.toLowerCase()}s.</p></div><ArrowUpRight size={19} className="text-muted" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{config.actions.map(([label, Icon, to]) => <a key={label} href={to} className="group flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-accent/50 hover:bg-surface-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={19}/></span><span className="flex-1 text-sm font-semibold">{label}</span><ArrowRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" /></a>)}</div></section>

    <section className="grid gap-4 xl:grid-cols-2">{config.sections.map((section) => <article key={section.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><section.icon size={19}/></span><div><h3 className="font-bold">{section.title}</h3><p className="text-xs text-muted">Modules planned for this role</p></div></div><div className="divide-y divide-border">{section.items.map(([title, desc]) => <div key={title} className="flex gap-3 py-3 first:pt-0 last:pb-0"><div className="mt-0.5"><CircleCheck size={16} className="text-accent"/></div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{desc}</p></div></div>)}</div></article>)}</section>

    <section className="flex gap-3 rounded-2xl border border-border bg-surface-2/60 p-4"><AlertCircle size={18} className="mt-0.5 shrink-0 text-muted"/><div><p className="text-sm font-semibold">Data connection not included in this dashboard phase</p><p className="mt-1 text-xs leading-5 text-muted">Summary values intentionally show “—” instead of fake company numbers. The dashboard is a role-based UI preview; live database values, authentication-based role selection and API permission enforcement will be connected in the database/backend phase.</p></div></section>
  </div>;
}
