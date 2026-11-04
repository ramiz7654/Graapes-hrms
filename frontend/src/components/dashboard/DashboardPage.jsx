import { useEffect, useState } from 'react';
import { ArrowRight, CircleCheck, CheckCircle2, Users, UserCheck, UserX, ClipboardCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import './dashboard.css';

function mapStatValue(label, stats) {
  if (!stats) return '—';
  const l = String(label || '').toLowerCase();
  if (l.includes('total employee') || l === 'employees' || l.includes('headcount')) return stats.totalEmployees ?? 0;
  if (l.includes('departments')) return stats.departments ?? 0;
  if (l.includes('active user') || l.includes('account')) return stats.activeAccounts ?? 0;
  if (l.includes('admin issue')) return stats.pendingAdminIssues ?? 0;
  if (l.includes('present today') || l.includes('team present')) return stats.presentToday ?? stats.teamPresentToday ?? 0;
  if (l.includes('leave request') || l.includes('pending leave')) return stats.pendingLeaves ?? 0;
  if (l.includes('upcoming holiday')) return stats.upcomingHolidays ?? 0;
  if (l.includes('team member')) return stats.teamMembers ?? 0;
  if (l.includes('pending approval')) return stats.pendingApprovals ?? 0;
  if (l.includes('upcoming team leave')) return stats.upcomingTeamLeave ?? 0;
  if (l.includes('monthly attendance') || l.includes('my attendance')) return stats.monthlyAttendance ?? 0;
  if (l.includes('leave balance')) return stats.leaveBalance ?? 0;
  if (l.includes('requests in progress') || l.includes('pending requests') || l.includes('progress')) return stats.requestsInProgress ?? 0;
  if (l.includes('next holiday')) return stats.nextHoliday ?? '—';
  return '—';
}

function StatCard({ item, stats, loadState }) {
  const Icon = item.icon;
  const value = mapStatValue(item.label, stats);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={19} />
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${loadState === 'error' ? 'text-danger' : loadState === 'loaded' ? 'text-success' : 'text-muted'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${loadState === 'error' ? 'bg-danger' : loadState === 'loaded' ? 'bg-success' : 'bg-muted'}`}></span>
          {loadState === 'error' ? 'Unavailable' : loadState === 'loaded' ? 'Live data' : 'Loading'}
        </span>
      </div>
      <p className="mt-4 text-sm text-muted">{item.label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted">{item.note}</p>
    </article>
  );
}

export default function DashboardPage({ config }) {
  const [stats, setStats] = useState(null);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    let alive = true;
    api('/dashboard/stats')
      .then((data) => {
        if (alive && data?.stats) {
          setStats(data.stats);
          setLoadState('loaded');
        } else if (alive) setLoadState('error');
      })
      .catch(() => {
        if (alive) setLoadState('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{config.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{config.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{config.subtitle}</p>
      </section>

      <section aria-label="Dashboard summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {config.stats.map((item) => (
          <StatCard key={item.label} item={item} stats={stats} loadState={loadState} />
        ))}
      </section>

      {config.showQuickActions !== false && <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <h3 className="font-bold">Quick actions</h3>
        <p className="mt-1 text-xs text-muted">Common tasks for your role</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(config.actions || []).map((item) => (
            <a key={item.label} href={item.to} className="group flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-accent/50 hover:bg-surface-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><item.icon size={19} /></span>
              <span className="flex-1 text-sm font-semibold">{item.label}</span>
              <ArrowRight size={16} className="text-muted group-hover:text-accent" />
            </a>
          ))}
        </div>
      </section>}

      {config.showWorkforceCharts && <section className="grid gap-4 xl:grid-cols-2" aria-label="Workforce analytics">
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Workforce overview</h3><p className="mt-1 text-xs text-muted">Active employee records in the system</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Users size={19}/></span></div>
          <div className="mt-6 flex items-end gap-3"><p className="text-4xl font-bold tracking-tight">{loadState === 'loaded' ? (stats?.totalEmployees ?? 0) : '—'}</p><p className="pb-1 text-sm text-muted">active employees</p></div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: loadState === 'loaded' && (stats?.totalEmployees ?? 0) > 0 ? '100%' : '0%' }}/></div>
          <p className="mt-2 text-xs text-muted">Employee headcount from the HRMS database</p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Today's attendance</h3><p className="mt-1 text-xs text-muted">Present includes Present and Late records</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><UserCheck size={19}/></span></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-sm text-muted"><UserCheck size={16}/> Present</div><p className="mt-2 text-3xl font-bold">{loadState === 'loaded' ? (stats?.presentToday ?? 0) : '—'}</p><p className="mt-1 text-xs text-muted">Recorded today</p></div>
            <div className="rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-sm text-muted"><ClipboardCheck size={16}/> Not marked</div><p className="mt-2 text-3xl font-bold">{loadState === 'loaded' ? Math.max(0, (stats?.totalEmployees ?? 0) - (stats?.presentToday ?? 0)) : '—'}</p><p className="mt-1 text-xs text-muted">Not counted as absent</p></div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: loadState === 'loaded' && (stats?.totalEmployees ?? 0) > 0 ? `${Math.min(100, ((stats?.presentToday ?? 0) / stats.totalEmployees) * 100)}%` : '0%' }}/></div>
          <div className="mt-2 flex justify-between text-xs text-muted"><span>Attendance coverage</span><span>{loadState === 'loaded' && (stats?.totalEmployees ?? 0) > 0 ? `${Math.round(((stats?.presentToday ?? 0) / stats.totalEmployees) * 100)}%` : '—'}</span></div>
        </article>
      </section>}

      <section className="grid gap-4 xl:grid-cols-2">
        {config.sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h3 className="font-bold">{section.title}</h3>
            <div className="mt-3 divide-y divide-border">
              {section.items.map((item) => (
                <div key={item.title} className="flex gap-3 py-3">
                  <CircleCheck size={16} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="flex gap-3 rounded-2xl border border-border bg-surface-2/60 p-4">
        <CheckCircle2 size={18} className={`mt-0.5 shrink-0 ${loadState === 'loaded' ? 'text-success' : loadState === 'error' ? 'text-danger' : 'text-muted'}`} />
        <div>
          <p className="text-sm font-semibold">{loadState === 'loaded' ? 'Dashboard data loaded' : loadState === 'error' ? 'Dashboard data unavailable' : 'Loading dashboard data'}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {loadState === 'loaded' ? 'Statistics were returned successfully by the HRMS API.' : loadState === 'error' ? 'The API did not return dashboard statistics. Check the server connection and try again.' : 'Waiting for the HRMS API to return your role-specific statistics.'}
          </p>
        </div>
      </section>
    </div>
  );
}
