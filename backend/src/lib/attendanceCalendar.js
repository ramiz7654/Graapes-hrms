import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { getCompanyTodayDateString, parseDateOnly } from './dateUtils.js';

/**
 * Attendance rows only exist for days an employee checked in. This helper derives the missing piece:
 * a working day with NO check-in, NO approved leave and NO holiday (for the employee's location) is ABSENT.
 *
 * Rules
 *  - counting starts on the day the employee record (ID) was created, not the joining date
 *  - weekly off days (default Saturday + Sunday, org setting `weeklyOffDays`) are never absent
 *  - holidays apply when published and either "All Locations" or equal to the employee's work location
 *  - today only becomes absent after the shift end time; future days are never absent
 * Nothing is written to the database, so history corrects itself.
 */

export const ALL_LOCATIONS = 'All Locations';
const DAY_MS = 86400000;
const normalize = (value) => String(value || '').trim().toLowerCase();

export const isAllLocations = (location) => !location || ['all locations', 'all'].includes(normalize(location));

export const holidayAppliesTo = (holiday, workLocation) =>
  isAllLocations(holiday.location) || normalize(holiday.location) === normalize(workLocation);

/** Prisma `where` fragment: holidays visible to someone working at `workLocation`. */
export const holidayLocationWhere = (workLocation) => ({
  OR: [
    { location: null },
    { location: { in: [ALL_LOCATIONS, 'All', 'all locations'] } },
    ...(workLocation ? [{ location: workLocation }] : []),
  ],
});

const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

function toMinutes(hhmm, fallbackH, fallbackM) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : fallbackH) * 60 + (Number.isFinite(m) ? m : fallbackM);
}

function localMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value || 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value || 0);
}

/** Calendar date (YYYY-MM-DD) of an instant in the company timezone. */
export function companyDateString(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}

/** Company calendar settings used by every attendance screen. */
export async function loadCalendarSettings() {
  const rows = await prisma.organizationSetting.findMany({ where: { key: { in: ['workEnd', 'timezone', 'weeklyOffDays'] } } });
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const timeZone = String(settings.timezone || env.COMPANY_TIMEZONE || 'Asia/Kolkata');
  const weeklyOff = Array.isArray(settings.weeklyOffDays) ? settings.weeklyOffDays.map(Number) : [0, 6];
  const todayStr = getCompanyTodayDateString(timeZone);
  const shiftEnded = localMinutes(new Date(), timeZone) >= toMinutes(settings.workEnd || '18:30', 18, 30);
  // Last date that may be counted as absent: today once the shift is over, otherwise yesterday.
  const lastCountable = new Date(parseDateOnly(todayStr).getTime() - (shiftEnded ? 0 : DAY_MS));
  return { timeZone, weeklyOff, todayStr, shiftEnded, lastCountable };
}

/**
 * Absent dates for the given employees inside [from, to] (UTC-midnight Dates).
 * employees: [{ id, createdAt, workLocation }]
 * Returns [{ employeeId, date: 'YYYY-MM-DD' }]
 */
export async function getVirtualAbsences({ employees, from, to, settings }) {
  if (!employees.length) return [];
  const cfg = settings || (await loadCalendarSettings());
  const end = new Date(Math.min(to.getTime(), cfg.lastCountable.getTime()));
  if (end < from) return [];

  const ids = employees.map((e) => e.id);
  const [records, holidays, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { employeeId: { in: ids }, date: { gte: from, lte: end } }, select: { employeeId: true, date: true } }),
    prisma.holiday.findMany({ where: { isPublished: true, date: { gte: from, lte: end } }, select: { date: true, location: true } }),
    prisma.leaveRequest.findMany({ where: { employeeId: { in: ids }, status: 'APPROVED', startDate: { lte: end }, endDate: { gte: from } }, select: { employeeId: true, startDate: true, endDate: true } }),
  ]);

  const hasRecord = new Set(records.map((r) => `${r.employeeId}|${isoDate(r.date)}`));
  const holidaysByDate = new Map();
  holidays.forEach((h) => { const key = isoDate(h.date); holidaysByDate.set(key, [...(holidaysByDate.get(key) || []), h]); });
  const leavesByEmployee = new Map();
  leaves.forEach((l) => leavesByEmployee.set(l.employeeId, [...(leavesByEmployee.get(l.employeeId) || []), l]));

  const absences = [];
  employees.forEach((employee) => {
    const createdDay = parseDateOnly(companyDateString(employee.createdAt, cfg.timeZone));
    const start = new Date(Math.max(from.getTime(), createdDay.getTime()));
    const employeeLeaves = leavesByEmployee.get(employee.id) || [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const day = new Date(t);
      if (cfg.weeklyOff.includes(day.getUTCDay())) continue;
      const key = isoDate(day);
      if (hasRecord.has(`${employee.id}|${key}`)) continue;
      if ((holidaysByDate.get(key) || []).some((h) => holidayAppliesTo(h, employee.workLocation))) continue;
      if (employeeLeaves.some((l) => l.startDate <= day && l.endDate >= day)) continue;
      absences.push({ employeeId: employee.id, date: key });
    }
  });
  return absences;
}

/**
 * Status for ONE employee on ONE date that has no attendance record.
 * Used by the "attendance on a date" overview.
 */
export async function statusForMissingRecord({ employee, dateStr, settings }) {
  const cfg = settings || (await loadCalendarSettings());
  const date = parseDateOnly(dateStr);
  const createdDay = companyDateString(employee.createdAt, cfg.timeZone);
  if (dateStr < createdDay || date > cfg.lastCountable) return 'NOT_MARKED';
  if (cfg.weeklyOff.includes(date.getUTCDay())) return 'HOLIDAY';
  const [holidays, leave] = await Promise.all([
    prisma.holiday.findMany({ where: { isPublished: true, date }, select: { location: true } }),
    prisma.leaveRequest.findFirst({ where: { employeeId: employee.id, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } }, select: { id: true } }),
  ]);
  if (holidays.some((h) => holidayAppliesTo(h, employee.workLocation))) return 'HOLIDAY';
  if (leave) return 'LEAVE';
  return 'ABSENT';
}
