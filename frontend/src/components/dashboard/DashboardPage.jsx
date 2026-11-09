import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertCircle, BriefcaseBusiness, Cake, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Gift,
  Megaphone, PartyPopper, Plane, RefreshCw, TrendingUp, UserPlus, Users, UserCheck, Building2, PieChart, Timer,
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  AreaChart, Avatar, Card, Donut, EmptyNote, HBars, Legend, Ring, StackedBars, StatusChip, STATUS_COLORS, STATUS_LABELS,
} from './charts.jsx';
import './dashboard.css';

/* ------------------------------ helpers ------------------------------ */

const DAY_MS = 86400000;
const fmtDate = (value, opts = { day: '2-digit', month: 'short' }) =>
  value ? new Date(value).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' }) : '—';
const todayUtc = () => { const t = new Date(); return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()); };
const daysUntil = (value) => Math.round((new Date(value).getTime() - todayUtc()) / DAY_MS);
const relativeDays = (n) => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`);
const fmtTime = (value, timeZone) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timeZone || 'Asia/Kolkata' }) : '—';

const ATTENDANCE_KEYS = ['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HOLIDAY', 'NOT_MARKED'];
const TREND_PARTS = [
  { key: 'Present', field: 'present', color: STATUS_COLORS.PRESENT },
  { key: 'Late', field: 'late', color: STATUS_COLORS.LATE },
  { key: 'Absent', field: 'absent', color: STATUS_COLORS.ABSENT },
  { key: 'On leave', field: 'leave', color: STATUS_COLORS.LEAVE },
];
const TREND_LEGEND = TREND_PARTS.map((p) => ({ label: p.key, color: p.color }));

const toParts = (row) => TREND_PARTS.map((p) => ({ key: p.key, value: row[p.field] || 0, color: p.color }));

/* ------------------------------ stat cards ------------------------------ */

function formatStatValue(value, format) {
  if (value == null) return '—';
  if (format === 'days') return `${Number(value) % 1 === 0 ? Number(value) : Number(value).toFixed(1)}`;
  return value;
}

function StatCard({ item, stats, analytics, loadState }) {
  const Icon = item.icon;
  const value = formatStatValue(stats?.[item.key], item.format);
  const note = typeof item.note === 'function' ? item.note(stats, analytics) : item.note;
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={19} /></span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${loadState === 'error' ? 'text-danger' : loadState === 'loaded' ? 'text-success' : 'text-muted'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${loadState === 'error' ? 'bg-danger' : loadState === 'loaded' ? 'bg-success' : 'bg-muted'}`} />
          {loadState === 'error' ? 'Unavailable' : loadState === 'loaded' ? 'Live data' : 'Loading'}
        </span>
      </div>
      <p className="mt-4 text-sm text-muted">{item.label}</p>
      <p className={`mt-1 font-bold ${item.key === 'nextHoliday' ? 'truncate text-xl' : 'text-2xl'}`} title={String(value)}>{loadState === 'loaded' ? value : '—'}</p>
      <p className="mt-1 text-xs text-muted">{loadState === 'loaded' ? note : ''}&nbsp;</p>
    </article>
  );
}

/* ------------------------------ shared widgets ------------------------------ */

function AttendanceTodayCard({ analytics, title, subtitle }) {
  const a = analytics.attendance || {};
  const segments = ATTENDANCE_KEYS.map((key) => ({ label: STATUS_LABELS[key], value: a[key] || 0, color: STATUS_COLORS[key] }));
  const total = segments.reduce((s, x) => s + x.value, 0);
  const present = (a.PRESENT || 0) + (a.LATE || 0);
  // Percentage is out of people expected to work today (holiday / weekly off are excluded).
  const expected = total - (a.HOLIDAY || 0);
  const percentLabel = expected > 0 ? `${Math.round((present / expected) * 100)}%` : 'Off day';
  const rules = analytics.attendanceRules || {};
  return (
    <Card title={title} subtitle={subtitle} icon={Activity}>
      {total === 0 ? <EmptyNote>No active employees in this view yet.</EmptyNote> : (
        <div className="flex flex-wrap items-center gap-6">
          <Donut segments={segments} centerValue={percentLabel} centerLabel={expected > 0 ? 'Present' : 'No working day'} />
          <div className="min-w-0 flex-1 space-y-2.5 text-sm">
            {segments.map((s) => (
              <div className="flex items-center justify-between gap-3" key={s.label}>
                <span className="inline-flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <b>{s.value}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Shift {rules.workStart || '09:30'}–{rules.workEnd || '18:30'} · {rules.graceMinutes ?? 15} min grace period</p>
    </Card>
  );
}

function DailyTrendCard({ analytics, title = 'Last 14 days' }) {
  const data = (analytics.dailyTrend || []).map((d) => ({ label: String(d.label).split(' ')[0], parts: toParts(d) }));
  const hasData = data.some((d) => d.parts.some((p) => p.value > 0));
  return (
    <Card title={title} subtitle="Daily attendance status" icon={TrendingUp}>
      {hasData ? (<><StackedBars data={data} showEvery={2} /><div className="mt-4"><Legend items={TREND_LEGEND} /></div></>) : <EmptyNote>No attendance recorded in the last 14 days.</EmptyNote>}
    </Card>
  );
}

function MonthlyTrendCard({ analytics, title = 'Monthly attendance trend', subtitle = 'Status breakdown for the last six months' }) {
  const data = (analytics.attendanceTrend || []).map((m) => ({ label: m.month, parts: toParts(m) }));
  const hasData = data.some((d) => d.parts.some((p) => p.value > 0));
  return (
    <Card title={title} subtitle={subtitle} icon={ClipboardCheck}>
      {hasData ? (<><StackedBars data={data} height={170} /><div className="mt-4"><Legend items={TREND_LEGEND} /></div></>) : <EmptyNote>No attendance history yet.</EmptyNote>}
    </Card>
  );
}

function GrowthCard({ analytics, title = 'Workforce growth', subtitle = 'Active headcount over the last six months' }) {
  const data = (analytics.workforceGrowth || []).map((g) => ({ label: g.month, value: g.employees }));
  return (
    <Card title={title} subtitle={subtitle} icon={TrendingUp}>
      {data.length ? <AreaChart data={data} /> : <EmptyNote>No headcount history yet.</EmptyNote>}
    </Card>
  );
}

function DepartmentCard({ analytics }) {
  const items = (analytics.departments || []).slice(0, 7).map((d) => ({ label: d.name, value: d.headcount }));
  return (
    <Card title="Headcount by department" subtitle="Active employees per department" icon={Building2}>
      {items.length ? <HBars items={items} /> : <EmptyNote>No department records yet.</EmptyNote>}
    </Card>
  );
}

const ROLE_COLORS = { SUPER_ADMIN: '#64748b', HR_ADMIN: 'var(--accent)', MANAGER: '#0ea5e9', EMPLOYEE: 'var(--success)', FINANCE: '#f59e0b' };

function RoleMixCard({ analytics }) {
  const segments = (analytics.roleDistribution || []).map((r) => ({ label: r.label, value: r.count, color: ROLE_COLORS[r.role] || 'var(--muted)' }));
  return (
    <Card title="People by role" subtitle="Active accounts grouped by role" icon={PieChart}>
      {segments.length ? (
        <div className="flex flex-wrap items-center gap-6">
          <Donut segments={segments} centerLabel="People" />
          <div className="min-w-0 flex-1 space-y-2.5 text-sm">
            {segments.map((s) => (
              <div className="flex items-center justify-between gap-3" key={s.label}>
                <span className="inline-flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <b>{s.value}</b>
              </div>
            ))}
          </div>
        </div>
      ) : <EmptyNote>No people records yet.</EmptyNote>}
    </Card>
  );
}

function LeaveTypeCard({ analytics }) {
  const items = (analytics.leaveTypeDistribution || []).map((l) => ({ label: l.name, value: l.count, sub: `${l.days} day${l.days === 1 ? '' : 's'}` }));
  return (
    <Card title="Leave by type" subtitle="Approved and pending requests this year" icon={Plane}>
      {items.length ? <HBars items={items} color="#0ea5e9" /> : <EmptyNote>No leave requests recorded this year.</EmptyNote>}
    </Card>
  );
}

function PendingApprovalsCard({ analytics }) {
  const items = analytics.pendingItems || [];
  return (
    <Card
      title="Pending approvals"
      subtitle={`${analytics.pendingLeaves || 0} leave · ${analytics.pendingCorrections || 0} attendance corrections`}
      icon={Clock3}
    >
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar name={item.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="truncate text-xs text-muted">
                  {item.title} · {item.kind === 'LEAVE' && item.from !== item.to ? `${fmtDate(item.from)} – ${fmtDate(item.to)}` : fmtDate(item.from)}
                  {item.days ? ` · ${item.days}d` : ''}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.kind === 'LEAVE' ? 'bg-accent-soft text-accent' : 'bg-warning-soft text-warning'}`}>
                {item.kind === 'LEAVE' ? 'Leave' : 'Correction'}
              </span>
            </li>
          ))}
        </ul>
      ) : <EmptyNote>Nothing is waiting for approval.</EmptyNote>}
    </Card>
  );
}

function OnLeaveCard({ analytics, title = 'On leave today' }) {
  const items = analytics.onLeaveToday || [];
  return (
    <Card title={title} subtitle="Approved leave covering today" icon={Plane}>
      {items.length ? (
        <ul className="space-y-3">
          {items.map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <Avatar name={l.name} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.name}</p><p className="truncate text-xs text-muted">{l.leaveType} · until {fmtDate(l.to)}</p></div>
            </li>
          ))}
        </ul>
      ) : <EmptyNote>Everyone is available today.</EmptyNote>}
    </Card>
  );
}

function RecentJoinersCard({ analytics }) {
  const items = analytics.recentJoiners || [];
  return (
    <Card title="Recent joiners" subtitle="Newest people in this view" icon={UserPlus}>
      {items.length ? (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <Avatar name={e.name} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{e.name}</p><p className="truncate text-xs text-muted">{e.department}</p></div>
              <span className="shrink-0 text-xs text-muted">{fmtDate(e.joiningDate, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </li>
          ))}
        </ul>
      ) : <EmptyNote>No joiners yet.</EmptyNote>}
    </Card>
  );
}

function PeopleCalendarCard({ analytics }) {
  const birthdays = analytics.upcomingBirthdays || [];
  const anniversaries = analytics.workAnniversaries || [];
  return (
    <Card title="Celebrations" subtitle="Birthdays and work anniversaries in the next 30 days" icon={Gift}>
      {birthdays.length || anniversaries.length ? (
        <ul className="space-y-3">
          {birthdays.map((b, i) => (
            <li key={`b-${i}`} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-soft text-warning"><Cake size={17} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{b.name}</p><p className="truncate text-xs text-muted">Birthday · {fmtDate(b.date)}</p></div>
              <span className="shrink-0 text-xs font-semibold text-muted">{relativeDays(b.daysAway)}</span>
            </li>
          ))}
          {anniversaries.map((x, i) => (
            <li key={`a-${i}`} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-soft text-success"><PartyPopper size={17} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{x.name}</p><p className="truncate text-xs text-muted">{x.years} year{x.years === 1 ? '' : 's'} at work · {fmtDate(x.date)}</p></div>
              <span className="shrink-0 text-xs font-semibold text-muted">{relativeDays(x.daysAway)}</span>
            </li>
          ))}
        </ul>
      ) : <EmptyNote>No birthdays or anniversaries in the next 30 days.</EmptyNote>}
    </Card>
  );
}

function AnnouncementsCard({ items }) {
  return (
    <Card title="Latest announcements" subtitle="Published company updates" icon={Megaphone}>
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.slice(0, 4).map((a) => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-semibold">{a.title}</p>
              {(a.publishAt || a.createdAt) && <p className="mt-0.5 text-xs text-muted">{fmtDate(a.publishAt || a.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
            </li>
          ))}
        </ul>
      ) : <EmptyNote>No announcements right now.</EmptyNote>}
    </Card>
  );
}

/** One big card; each holiday is a small card inside it. */
function HolidaysCard({ holidays }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6" aria-label="Upcoming holidays">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Upcoming holidays</h3>
          <p className="mt-1 text-xs text-muted">{holidays.length ? `Next ${holidays.length} published holiday${holidays.length === 1 ? '' : 's'}` : 'Published company holidays'}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><CalendarDays size={19} /></span>
      </div>
      {holidays.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {holidays.map((h) => {
            const away = daysUntil(h.date);
            return (
              <article key={h.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface-2/60 p-3.5">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <div className="text-center leading-none">
                    <p className="text-lg font-bold">{fmtDate(h.date, { day: '2-digit' })}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase">{fmtDate(h.date, { month: 'short' })}</p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={h.name}>{h.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{fmtDate(h.date, { weekday: 'long' })}</p>
                  <span className="mt-1.5 inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-border">{relativeDays(away)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="mt-5"><EmptyNote>No published upcoming holidays.</EmptyNote></div>}
    </section>
  );
}

/* ------------------------------ manager widgets ------------------------------ */

function TeamTodayCard({ team }) {
  return (
    <Card title="My team today" subtitle="Attendance status of each team member" icon={Users}>
      {team.length ? (
        <ul className="divide-y divide-border">
          {team.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.name}</p><p className="truncate text-xs text-muted">{m.designation || m.code}</p></div>
              <StatusChip status={m.status} />
            </li>
          ))}
        </ul>
      ) : <EmptyNote>No employees are assigned to you yet.</EmptyNote>}
    </Card>
  );
}

/* ------------------------------ employee widgets ------------------------------ */

function MyTodayCard({ analytics }) {
  const me = analytics.me || {};
  const today = me.today || { status: 'NOT_MARKED' };
  const tz = analytics.attendanceRules?.timezone;
  let worked = '—';
  if (today.firstIn && today.lastOut) {
    const mins = Math.max(0, Math.round((new Date(today.lastOut) - new Date(today.firstIn)) / 60000));
    worked = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  }
  return (
    <Card title="Today" subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })} icon={Timer}>
      <div className="flex items-center justify-between gap-3">
        <StatusChip status={today.status} />
        {me.profile?.designation && <span className="truncate text-xs text-muted">{me.profile.designation}</span>}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[['Check-in', fmtTime(today.firstIn, tz)], ['Check-out', fmtTime(today.lastOut, tz)], ['Hours', worked]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>
        ))}
      </div>
    </Card>
  );
}

function MyMonthCard({ analytics }) {
  const month = analytics.me?.month || { present: 0, late: 0, absent: 0, leave: 0 };
  const worked = month.present + month.late;
  const tracked = worked + month.absent + month.leave;
  const percent = tracked ? (worked / tracked) * 100 : 0;
  return (
    <Card title="This month" subtitle="Your attendance so far" icon={ClipboardCheck}>
      <div className="flex flex-wrap items-center gap-6">
        <Ring percent={percent} size={124} thickness={13} label={`${worked}`} sub="days worked" color="var(--success)" />
        <div className="min-w-0 flex-1 space-y-2.5 text-sm">
          {[['Present', month.present, STATUS_COLORS.PRESENT], ['Late', month.late, STATUS_COLORS.LATE], ['Absent', month.absent, STATUS_COLORS.ABSENT], ['On leave', month.leave, STATUS_COLORS.LEAVE]].map(([label, value, color]) => (
            <div className="flex items-center justify-between gap-3" key={label}>
              <span className="inline-flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span><b>{value}</b>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MyCalendarCard({ analytics }) {
  const me = analytics.me || {};
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday first
  const statusByDate = new Map((me.calendar || []).map((c) => [c.date, c.status]));
  const holidayByDate = new Map((me.monthHolidays || []).map((h) => [new Date(h.date).toISOString().slice(0, 10), h.name]));
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const holiday = holidayByDate.get(key);
    const status = holiday && !statusByDate.has(key) ? 'HOLIDAY' : statusByDate.get(key);
    cells.push({ day, key, status, holiday, isToday: day === now.getDate() });
  }
  return (
    <Card title={now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} subtitle="Your attendance calendar" icon={CalendarDays}>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase text-muted">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => cell ? (
          <div
            key={cell.key}
            title={`${cell.day} ${now.toLocaleDateString('en-IN', { month: 'short' })}${cell.status ? ` · ${STATUS_LABELS[cell.status]}` : ''}${cell.holiday ? ` · ${cell.holiday}` : ''}`}
            className={`grid aspect-square place-items-center rounded-lg text-xs font-semibold ${cell.isToday ? 'ring-2 ring-[#2563eb] ring-offset-2 ring-offset-[var(--surface)]' : ''} ${cell.status || cell.isToday ? 'text-white' : 'bg-surface-2 text-muted'}`}
            style={cell.status ? { background: STATUS_COLORS[cell.status] } : cell.isToday ? { background: '#2563eb' } : undefined}
          >{cell.day}</div>
        ) : <span key={`e-${i}`} />)}
      </div>
      <div className="mt-4"><Legend items={[...['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HOLIDAY'].map((k) => ({ label: STATUS_LABELS[k], color: STATUS_COLORS[k] })), { label: 'Today', color: '#2563eb' }]} /></div>
    </Card>
  );
}

function LeaveBalanceCard({ analytics }) {
  const balances = analytics.me?.leaveBalances || [];
  return (
    <Card title="Leave balance" subtitle="Remaining days this year, by leave type" icon={BriefcaseBusiness}>
      {balances.length ? (
        <div className="space-y-4">
          {balances.map((b) => (
            <div key={b.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold">{b.name}</span>
                <span className="shrink-0 text-muted"><b className="text-text">{b.remaining}</b> of {b.total} left</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${b.total ? Math.max(3, (b.remaining / b.total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyNote>No leave entitlement has been configured for you yet.</EmptyNote>}
    </Card>
  );
}

const REQUEST_TONES = {
  APPROVED: 'bg-success-soft text-success',
  PENDING: 'bg-warning-soft text-warning',
  REJECTED: 'bg-danger-soft text-danger',
  CANCELLED: 'bg-surface-2 text-muted',
  CLARIFICATION_REQUESTED: 'bg-accent-soft text-accent',
};

function MyRequestsCard({ analytics }) {
  const items = analytics.me?.recentRequests || [];
  return (
    <Card title="My leave requests" subtitle="Your five most recent requests" icon={Plane}>
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.type}</p>
                <p className="truncate text-xs text-muted">{r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`} · {r.days}d</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${REQUEST_TONES[r.status] || 'bg-surface-2 text-muted'}`}>
                {String(r.status).replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </span>
            </li>
          ))}
        </ul>
      ) : <EmptyNote>You have not applied for leave yet.</EmptyNote>}
    </Card>
  );
}

function MyProfileCard({ analytics }) {
  const p = analytics.me?.profile;
  if (!p) return null;
  const rows = [['Employee ID', p.code], ['Department', p.department || '—'], ['Reporting manager', p.manager || '—'], ['Joined', fmtDate(p.joiningDate, { day: '2-digit', month: 'short', year: 'numeric' })]];
  return (
    <Card title="My work profile" subtitle={p.designation || 'Employee'} icon={UserCheck}>
      <div className="mb-4 flex items-center gap-3"><Avatar name={p.name} /><p className="font-semibold">{p.name}</p></div>
      <dl className="divide-y divide-border text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2.5 first:pt-0 last:pb-0"><dt className="text-muted">{k}</dt><dd className="truncate text-right font-semibold">{v}</dd></div>)}
      </dl>
    </Card>
  );
}

/* ------------------------------ page ------------------------------ */

export default function DashboardPage({ config }) {
  const role = String(config.role || '').toUpperCase();
  const [analytics, setAnalytics] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [announcements, setAnnouncements] = useState([]);

  const load = useCallback(() => {
    let alive = true;
    setLoadState('loading');
    api('/dashboard/analytics')
      .then((data) => { if (!alive) return; if (data?.analytics) { setAnalytics(data.analytics); setLoadState('loaded'); } else setLoadState('error'); })
      .catch(() => { if (alive) setLoadState('error'); });
    if (role === 'EMPLOYEE') {
      api('/announcements').then((data) => { if (alive) setAnnouncements(data?.announcements || data?.items || []); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [role]);

  useEffect(() => load(), [load]);

  const stats = analytics?.stats;
  const holidays = analytics?.upcomingHolidays || [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{config.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{config.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{config.subtitle}</p>
      </section>

<<<<<<< Updated upstream
      <section aria-label="Dashboard summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
=======
      <section aria-label="Dashboard summary" className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${config.stats.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
>>>>>>> Stashed changes
        {config.stats.map((item) => <StatCard key={item.label} item={item} stats={stats} analytics={analytics} loadState={loadState} />)}
      </section>

      {loadState === 'error' && (
        <section role="alert" className="flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
          <AlertCircle size={18} className="shrink-0" />
          <p className="flex-1">Dashboard data could not be loaded. Check the server connection and try again.</p>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold hover:bg-surface/60"><RefreshCw size={14} /> Retry</button>
        </section>
      )}

      {analytics && role === 'SUPER_ADMIN' && (
        <>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <AttendanceTodayCard analytics={analytics} title="Organization attendance" subtitle="Today's status across the whole company" />
            <DailyTrendCard analytics={analytics} title="Attendance, last 14 days" />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <GrowthCard analytics={analytics} />
            <DepartmentCard analytics={analytics} />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <MonthlyTrendCard analytics={analytics} />
            <RoleMixCard analytics={analytics} />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <PendingApprovalsCard analytics={analytics} />
            <LeaveTypeCard analytics={analytics} />
          </section>
          <HolidaysCard holidays={holidays} />
          <section className="grid min-w-0 gap-4 xl:grid-cols-3">
            <RecentJoinersCard analytics={analytics} />
            <PeopleCalendarCard analytics={analytics} />
            <AnnouncementsCard items={analytics.announcements || []} />
          </section>
        </>
      )}

      {analytics && role === 'HR_ADMIN' && (
        <>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <AttendanceTodayCard analytics={analytics} title="Workforce attendance" subtitle="Today's status across the whole company" />
            <DailyTrendCard analytics={analytics} title="Attendance, last 14 days" />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <MonthlyTrendCard analytics={analytics} />
            <LeaveTypeCard analytics={analytics} />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <PendingApprovalsCard analytics={analytics} />
            <OnLeaveCard analytics={analytics} />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <DepartmentCard analytics={analytics} />
            <GrowthCard analytics={analytics} title="Headcount growth" subtitle="Active headcount over the last six months" />
          </section>
          <HolidaysCard holidays={holidays} />
          <section className="grid min-w-0 gap-4 xl:grid-cols-3">
            <PeopleCalendarCard analytics={analytics} />
            <RecentJoinersCard analytics={analytics} />
            <AnnouncementsCard items={analytics.announcements || []} />
          </section>
        </>
      )}

      {analytics && role === 'MANAGER' && (
        <>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <AttendanceTodayCard analytics={analytics} title="Team attendance" subtitle="Today's status for your direct reports" />
            <DailyTrendCard analytics={analytics} title="Team attendance, last 14 days" />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <TeamTodayCard team={analytics.team || []} />
            <div className="grid min-w-0 gap-4">
              <PendingApprovalsCard analytics={analytics} />
              <OnLeaveCard analytics={analytics} title="Team on leave today" />
            </div>
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <MonthlyTrendCard analytics={analytics} title="Team monthly trend" subtitle="Your team's attendance over six months" />
            <PeopleCalendarCard analytics={analytics} />
          </section>
          <HolidaysCard holidays={holidays} />
        </>
      )}

      {analytics && role === 'EMPLOYEE' && (
        <>
          <section className="grid min-w-0 gap-4 xl:grid-cols-3">
            <MyTodayCard analytics={analytics} />
            <MyMonthCard analytics={analytics} />
            <MyProfileCard analytics={analytics} />
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <MyCalendarCard analytics={analytics} />
            <div className="grid min-w-0 gap-4">
              <LeaveBalanceCard analytics={analytics} />
              <MyRequestsCard analytics={analytics} />
            </div>
          </section>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <MonthlyTrendCard analytics={analytics} title="My attendance trend" subtitle="Your attendance over the last six months" />
            <AnnouncementsCard items={announcements} />
          </section>
          <HolidaysCard holidays={holidays} />
        </>
      )}

      {analytics && !['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role) && (
        <section className="flex gap-3 rounded-2xl border border-border bg-surface-2/60 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
          <p className="text-sm text-muted">No dashboard widgets are configured for this role.</p>
        </section>
      )}

      {loadState === 'loading' && !analytics && <p className="text-center text-sm text-muted">Loading dashboard data…</p>}
    </div>
  );
}
