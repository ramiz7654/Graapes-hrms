import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getCompanyTodayDateString, parseDateOnly } from '../../lib/dateUtils.js';
import { getVirtualAbsences, holidayAppliesTo, holidayLocationWhere, loadCalendarSettings } from '../../lib/attendanceCalendar.js';

const MONTH_FMT = { month: 'short', timeZone: 'UTC' };
const ISO = (d) => new Date(d).toISOString().slice(0, 10);
const toMinutes = (hhmm, fallbackH, fallbackM) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : fallbackH) * 60 + (Number.isFinite(m) ? m : fallbackM);
};

/**
 * Who is in this user's dashboard scope?
 *  - SUPER_ADMIN : everyone (null = no id filter)
 *  - HR_ADMIN    : everyone (all employees and all managers)
 *  - MANAGER     : direct team only (the manager's own record is NOT counted)
 *  - everyone else (EMPLOYEE, FINANCE ...) : only themselves, never company-wide data
 */
async function resolveScopeIds(user) {
  const ownId = user.employee?.id || null;
  if (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN') return null;
  if (user.role === 'MANAGER') {
    if (!ownId) return [];
    const team = await prisma.employee.findMany({ where: { managerId: ownId, isActive: true }, select: { id: true } });
    return team.map((e) => e.id);
  }
  return ownId ? [ownId] : [];
}

/** Single place that decides an attendance row's status, so cards, donut and trends always agree. */
function makeStatusResolver(orgSettings) {
  const timeZone = String(orgSettings.timezone || 'Asia/Kolkata');
  const lateThreshold = toMinutes(orgSettings.workStart || '09:30', 9, 30) + Math.max(0, Number(orgSettings.graceMinutes ?? 15));
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const localMinutes = (date) => {
    const parts = fmt.formatToParts(new Date(date));
    return Number(parts.find((p) => p.type === 'hour')?.value || 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value || 0);
  };
  const resolve = (record) => {
    const stored = String(record.status || '').toUpperCase();
    if (stored === 'ABSENT') return 'ABSENT';
    if (stored === 'LEAVE' || stored === 'ON_LEAVE') return 'LEAVE';
    if (stored === 'HOLIDAY') return 'HOLIDAY';
    if (stored === 'MISSING_PUNCH') return 'MISSING_PUNCH';
    if (record.firstIn) return localMinutes(record.firstIn) > lateThreshold ? 'LATE' : 'PRESENT';
    if (stored === 'PRESENT' || stored === 'LATE') return stored;
    return 'NOT_MARKED';
  };
  return { resolve, localMinutes, timeZone };
}

/** Next occurrence (today or later) of a month/day, used for birthdays and work anniversaries. */
function nextOccurrence(date, today) {
  const d = new Date(date);
  let candidate = new Date(Date.UTC(today.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (candidate < today) candidate = new Date(Date.UTC(today.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  const daysAway = Math.round((candidate - today) / 86400000);
  return { candidate, daysAway };
}

<<<<<<< Updated upstream
=======
// Active designations (those tied to an inactive department are not usable, so they are not counted).
const activeDesignationCount = () => prisma.designation.count({ where: { isActive: true, OR: [{ departmentId: null }, { department: { isActive: true } }] } });

>>>>>>> Stashed changes
async function buildAnalytics(user) {
  const todayStr = getCompanyTodayDateString();
  const today = parseDateOnly(todayStr);
  const year = today.getUTCFullYear();
  const monthStart = new Date(Date.UTC(year, today.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(year, today.getUTCMonth() + 1, 1));
  const trendStart = new Date(Date.UTC(year, today.getUTCMonth() - 5, 1));
  const dailyStart = new Date(today.getTime() - 13 * 86400000);
  const isEmployeeView = !['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user.role);

  const scopeIds = await resolveScopeIds(user);
  const employeeWhere = scopeIds ? { id: { in: scopeIds }, isActive: true } : { isActive: true };
  const byEmployee = scopeIds ? { employeeId: { in: scopeIds } } : {};

  const [employees, attendanceRows, pendingLeaveRows, pendingCorrectionRows, approvedLeaves, holidays, announcements, settingRows, yearLeaves, calendarSettings, todayHolidays] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true, fullName: true, employeeCode: true, dateOfBirth: true, joiningDate: true, createdAt: true, workLocation: true,
        department: { select: { name: true } }, designation: { select: { title: true } },
        userAccount: { select: { role: true } },
      },
      orderBy: { joiningDate: 'desc' },
    }),
    prisma.attendanceRecord.findMany({
      where: { ...byEmployee, date: { gte: trendStart, lte: today } },
      select: { employeeId: true, date: true, status: true, firstIn: true, lastOut: true },
    }),
    prisma.leaveRequest.findMany({
      where: { ...byEmployee, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, startDate: true, endDate: true, days: true, createdAt: true, employee: { select: { fullName: true } }, leaveType: { select: { name: true } } },
    }),
    prisma.attendanceCorrection.findMany({
      where: { ...byEmployee, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, date: true, reason: true, createdAt: true, employee: { select: { fullName: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { ...byEmployee, status: 'APPROVED', endDate: { gte: today } },
      orderBy: { startDate: 'asc' },
      select: { id: true, employeeId: true, startDate: true, endDate: true, employee: { select: { fullName: true } }, leaveType: { select: { name: true } } },
    }),
    // Super Admin sees every location's holidays; everyone else only "All Locations" + their own location.
    prisma.holiday.findMany({
      where: { date: { gte: today }, isPublished: true, ...(['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ? {} : holidayLocationWhere(user.employee?.workLocation)) },
      orderBy: { date: 'asc' }, take: 6,
    }),
    isEmployeeView
      ? Promise.resolve([])
      : prisma.announcement.findMany({
          where: { status: 'PUBLISHED', OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
          orderBy: { publishAt: 'desc' }, take: 4, select: { id: true, title: true, publishAt: true },
        }),
    prisma.organizationSetting.findMany({ where: { key: { in: ['workStart', 'workEnd', 'graceMinutes', 'timezone'] } } }),
    prisma.leaveRequest.findMany({
      where: { ...byEmployee, status: { in: ['APPROVED', 'PENDING'] }, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      select: { days: true, leaveType: { select: { name: true } } },
    }),
    loadCalendarSettings(),
    prisma.holiday.findMany({ where: { date: today, isPublished: true }, select: { location: true } }),
  ]);

  const orgSettings = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));
  const statusOf = makeStatusResolver(orgSettings);
  const workStart = String(orgSettings.workStart || '09:30');
  const workEnd = String(orgSettings.workEnd || '18:30');
  const graceMinutes = Math.max(0, Number(orgSettings.graceMinutes ?? 15));

  // ---- Today's attendance, one status per active employee in scope ----
  const todayRecordByEmployee = new Map();
  attendanceRows.filter((r) => ISO(r.date) === todayStr).forEach((r) => todayRecordByEmployee.set(r.employeeId, r));
  const onLeaveToday = approvedLeaves.filter((l) => l.startDate <= today && l.endDate >= today);
  const onLeaveIds = new Set(onLeaveToday.map((l) => l.employeeId));
  const todayIsWeeklyOff = calendarSettings.weeklyOff.includes(today.getUTCDay());
  const nowMinutes = statusOf.localMinutes(new Date());
  const endMinutes = toMinutes(workEnd, 18, 30);

  const attendance = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0, HOLIDAY: 0, MISSING_PUNCH: 0, NOT_MARKED: 0 };
  const todayStatusById = new Map();
  employees.forEach((e) => {
    let status;
    const record = todayRecordByEmployee.get(e.id);
    if (record) status = statusOf.resolve(record);
    else if (onLeaveIds.has(e.id)) status = 'LEAVE';
    else if (todayIsWeeklyOff || todayHolidays.some((h) => holidayAppliesTo(h, e.workLocation))) status = 'HOLIDAY';
    else status = nowMinutes >= endMinutes ? 'ABSENT' : 'NOT_MARKED';
    todayStatusById.set(e.id, status);
    attendance[status] += 1;
  });
  const presentToday = attendance.PRESENT + attendance.LATE;

  // ---- Headcount by department / role / growth ----
  const byDepartment = new Map();
  employees.forEach((e) => { const name = e.department?.name || 'Unassigned'; byDepartment.set(name, (byDepartment.get(name) || 0) + 1); });
  const departments = [...byDepartment].map(([name, headcount]) => ({ name, headcount })).sort((a, b) => b.headcount - a.headcount);

  const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', HR_ADMIN: 'HR', MANAGER: 'Managers', EMPLOYEE: 'Employees', FINANCE: 'Finance' };
  const roleCounts = new Map();
  employees.forEach((e) => { const role = e.userAccount?.role || 'EMPLOYEE'; roleCounts.set(role, (roleCounts.get(role) || 0) + 1); });
  const roleDistribution = [...roleCounts].map(([role, count]) => ({ role, label: ROLE_LABELS[role] || role, count }));

  const workforceGrowth = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(Date.UTC(year, today.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    workforceGrowth.push({ month: start.toLocaleDateString('en-IN', MONTH_FMT), employees: employees.filter((e) => e.joiningDate < next).length });
  }

  // ---- Attendance trends (6 months + last 14 days) ----
  const monthMap = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, today.getUTCMonth() - i, 1));
    monthMap.set(d.toISOString().slice(0, 7), { month: d.toLocaleDateString('en-IN', MONTH_FMT), present: 0, late: 0, absent: 0, leave: 0 });
  }
  const dayMap = new Map();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    dayMap.set(ISO(d), { date: ISO(d), label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }), present: 0, late: 0, absent: 0, leave: 0 });
  }
  attendanceRows.forEach((r) => {
    const status = statusOf.resolve(r);
    const key = { PRESENT: 'present', LATE: 'late', ABSENT: 'absent', LEAVE: 'leave' }[status];
    if (!key) return;
    const month = monthMap.get(r.date.toISOString().slice(0, 7));
    if (month) month[key] += 1;
    const day = dayMap.get(ISO(r.date));
    if (day) day[key] += 1;
  });

  // Working days with no check-in, leave or holiday are ABSENT (derived, nothing is stored).
  const virtualAbsences = await getVirtualAbsences({ employees, from: trendStart, to: today, settings: calendarSettings });
  virtualAbsences.forEach((a) => {
    const month = monthMap.get(a.date.slice(0, 7));
    if (month) month.absent += 1;
    const day = dayMap.get(a.date);
    if (day) day.absent += 1;
  });

  // ---- Pending approvals ----
  const pendingItems = [
    ...pendingLeaveRows.map((l) => ({ id: l.id, kind: 'LEAVE', name: l.employee?.fullName || 'Employee', title: l.leaveType?.name || 'Leave', from: l.startDate, to: l.endDate, days: Number(l.days), createdAt: l.createdAt })),
    ...pendingCorrectionRows.map((c) => ({ id: c.id, kind: 'CORRECTION', name: c.employee?.fullName || 'Employee', title: 'Attendance correction', from: c.date, to: c.date, reason: c.reason, createdAt: c.createdAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  // ---- Leave type distribution (this year) ----
  const leaveTypeMap = new Map();
  yearLeaves.forEach((r) => {
    const name = r.leaveType?.name || 'Other';
    const row = leaveTypeMap.get(name) || { name, count: 0, days: 0 };
    row.count += 1; row.days += Number(r.days || 0);
    leaveTypeMap.set(name, row);
  });
  const leaveTypeDistribution = [...leaveTypeMap.values()].sort((a, b) => b.count - a.count);

  // ---- People calendar: next 30 days ----
  const birthdays = [];
  const workAnniversaries = [];
  employees.forEach((e) => {
    if (e.dateOfBirth) {
      const { candidate, daysAway } = nextOccurrence(e.dateOfBirth, today);
      if (daysAway <= 30) birthdays.push({ name: e.fullName, date: candidate, daysAway, department: e.department?.name || null });
    }
    if (e.joiningDate) {
      const { candidate, daysAway } = nextOccurrence(e.joiningDate, today);
      const years = candidate.getUTCFullYear() - new Date(e.joiningDate).getUTCFullYear();
      if (daysAway <= 30 && years > 0) workAnniversaries.push({ name: e.fullName, date: candidate, daysAway, years });
    }
  });
  birthdays.sort((a, b) => a.daysAway - b.daysAway);
  workAnniversaries.sort((a, b) => a.daysAway - b.daysAway);

  // ---- Headline stat cards (same numbers as the charts) ----
  const pendingLeaves = pendingLeaveRows.length;
  const pendingCorrections = pendingCorrectionRows.length;
  const nextHoliday = holidays[0] || null;
  let stats;
  if (user.role === 'SUPER_ADMIN') {
<<<<<<< Updated upstream
    const [departmentCount, activeAccounts] = await Promise.all([
      prisma.department.count({ where: { isActive: true } }),
      prisma.userAccount.count({ where: { isActive: true } }),
    ]);
    stats = { totalEmployees: employees.length, departments: departmentCount, activeAccounts, pendingAdminIssues: pendingLeaves + pendingCorrections, presentToday };
  } else if (user.role === 'HR_ADMIN') {
    stats = { totalEmployees: employees.length, departments: departments.filter((d) => d.name !== 'Unassigned').length, presentToday, pendingLeaves, pendingCorrections, upcomingHolidays: holidays.length };
=======
    const [departmentCount, designationCount, activeAccounts] = await Promise.all([
      prisma.department.count({ where: { isActive: true } }),
      activeDesignationCount(),
      prisma.userAccount.count({ where: { isActive: true } }),
    ]);
    stats = { totalEmployees: employees.length, departments: departmentCount, designations: designationCount, activeAccounts, pendingAdminIssues: pendingLeaves + pendingCorrections, presentToday };
  } else if (user.role === 'HR_ADMIN') {
    stats = { totalEmployees: employees.length, departments: departments.filter((d) => d.name !== 'Unassigned').length, designations: await activeDesignationCount(), presentToday, pendingLeaves, pendingCorrections, upcomingHolidays: holidays.length };
>>>>>>> Stashed changes
  } else if (user.role === 'MANAGER') {
    stats = {
      teamMembers: employees.length,
      teamPresentToday: presentToday,
      pendingApprovals: pendingLeaves + pendingCorrections,
      upcomingTeamLeave: approvedLeaves.filter((l) => l.startDate >= today).length,
    };
  } else {
    stats = {};
  }

  const analytics = {
    stats,
    totalEmployees: employees.length,
    activeEmployees: employees.length,
    departments,
    roleDistribution,
    attendance,
    presentToday,
    attendanceRules: { workStart, workEnd, graceMinutes, timezone: statusOf.timeZone },
    workforceGrowth,
    pendingLeaves,
    pendingCorrections,
    pendingApprovals: pendingLeaves + pendingCorrections,
    pendingItems,
    leaveTypeDistribution,
    attendanceTrend: [...monthMap.values()],
    dailyTrend: [...dayMap.values()],
    upcomingBirthdays: birthdays.slice(0, 6),
    workAnniversaries: workAnniversaries.slice(0, 6),
    upcomingHolidays: holidays.map((h) => ({ id: h.id, name: h.name, date: h.date, location: h.location || null })),
    onLeaveToday: onLeaveToday.slice(0, 8).map((l) => ({ id: l.id, name: l.employee?.fullName || 'Employee', leaveType: l.leaveType?.name || 'Leave', to: l.endDate })),
    announcements,
    recentJoiners: employees.slice(0, 5).map((e) => ({ id: e.id, name: e.fullName, joiningDate: e.joiningDate, department: e.department?.name || 'Unassigned' })),
  };

  // ---- Manager: the team with today's status ----
  if (user.role === 'MANAGER') {
    analytics.team = employees.map((e) => {
      const record = todayRecordByEmployee.get(e.id);
      return { id: e.id, name: e.fullName, code: e.employeeCode, designation: e.designation?.title || null, status: todayStatusById.get(e.id), firstIn: record?.firstIn || null };
    });
  }

  // ---- Employee: personal workspace ----
  if (isEmployeeView) {
    const ownId = user.employee?.id || null;
    const me = { profile: null, today: null, month: { present: 0, late: 0, absent: 0, leave: 0 }, calendar: [], monthHolidays: [], leaveBalances: [], recentRequests: [] };
    if (ownId) {
      const [profile, monthHolidays, ledger, leaveTypes, recentRequests, inProgress] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: ownId },
          select: { fullName: true, employeeCode: true, joiningDate: true, department: { select: { name: true } }, designation: { select: { title: true } }, manager: { select: { fullName: true } } },
        }),
        prisma.holiday.findMany({ where: { isPublished: true, date: { gte: monthStart, lt: nextMonthStart }, ...holidayLocationWhere(user.employee?.workLocation) }, orderBy: { date: 'asc' } }),
        prisma.leaveLedgerEntry.findMany({ where: { employeeId: ownId, year } }),
        prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        prisma.leaveRequest.findMany({
          where: { employeeId: ownId }, orderBy: { createdAt: 'desc' }, take: 5,
          select: { id: true, startDate: true, endDate: true, days: true, status: true, leaveType: { select: { name: true } } },
        }),
        prisma.leaveRequest.count({ where: { employeeId: ownId, status: 'PENDING' } }),
      ]);

      me.profile = profile ? {
        name: profile.fullName, code: profile.employeeCode, joiningDate: profile.joiningDate,
        department: profile.department?.name || null, designation: profile.designation?.title || null, manager: profile.manager?.fullName || null,
      } : null;
      me.monthHolidays = monthHolidays.map((h) => ({ id: h.id, name: h.name, date: h.date }));

      const todayRecord = todayRecordByEmployee.get(ownId);
      me.today = { status: todayStatusById.get(ownId) || 'NOT_MARKED', firstIn: todayRecord?.firstIn || null, lastOut: todayRecord?.lastOut || null };

      attendanceRows.filter((r) => r.date >= monthStart && r.date < nextMonthStart).forEach((r) => {
        const status = statusOf.resolve(r);
        me.calendar.push({ date: ISO(r.date), status });
        const key = { PRESENT: 'present', LATE: 'late', ABSENT: 'absent', LEAVE: 'leave' }[status];
        if (key) me.month[key] += 1;
      });

      virtualAbsences
        .filter((a) => a.employeeId === ownId && a.date >= ISO(monthStart) && a.date < ISO(nextMonthStart))
        .forEach((a) => { me.calendar.push({ date: a.date, status: 'ABSENT' }); me.month.absent += 1; });

      let totalBalance = 0;
      leaveTypes.forEach((lt) => {
        const used = ledger.filter((e) => e.leaveTypeId === lt.id && e.kind === 'USED').reduce((s, e) => s + Number(e.days), 0);
        const credited = ledger.filter((e) => e.leaveTypeId === lt.id && ['ACCRUAL', 'OPENING', 'ADJUSTMENT'].includes(e.kind)).reduce((s, e) => s + Number(e.days), 0);
        const allowance = lt.annualAllowance == null ? null : Number(lt.annualAllowance);
        const total = credited > 0 ? credited : allowance;
        if (total == null) return;
        const remaining = Math.max(0, total - used);
        totalBalance += remaining;
        me.leaveBalances.push({ name: lt.name, total, used, remaining });
      });
      me.recentRequests = recentRequests.map((r) => ({ id: r.id, type: r.leaveType?.name || 'Leave', from: r.startDate, to: r.endDate, days: Number(r.days), status: r.status }));

      analytics.stats = {
        monthlyAttendance: me.month.present + me.month.late,
        leaveBalance: totalBalance,
        requestsInProgress: inProgress,
        nextHoliday: nextHoliday ? nextHoliday.name : 'None upcoming',
        nextHolidayDate: nextHoliday ? nextHoliday.date : null,
      };
    } else {
      analytics.stats = { monthlyAttendance: 0, leaveBalance: 0, requestsInProgress: 0, nextHoliday: 'None upcoming', nextHolidayDate: null };
    }
    analytics.me = me;
  }

  return analytics;
}

export function dashboardRouter() {
  const router = Router();

  // GET /api/dashboard/stats - headline numbers (same source as /analytics so they never disagree).
  router.get('/stats', requireAuth, async (req, res, next) => {
    try {
      const analytics = await buildAnalytics(req.user);
      return res.json({ stats: analytics.stats });
    } catch (error) { return next(error); }
  });

  // GET /api/dashboard/analytics - role-scoped stats + chart data.
  router.get('/analytics', requireAuth, async (req, res, next) => {
    try {
      return res.json({ analytics: await buildAnalytics(req.user) });
    } catch (error) { return next(error); }
  });

  return router;
}
