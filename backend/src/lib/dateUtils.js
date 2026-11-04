import { env } from '../config/env.js';

/**
 * Returns today's ISO date string (YYYY-MM-DD) in the company's configured timezone.
 */
export function getCompanyTodayDateString(timeZone = env.COMPANY_TIMEZONE || 'Asia/Kolkata') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Converts a YYYY-MM-DD string into a UTC midnight Date object suitable for Prisma @db.Date.
 */
export function parseDateOnly(dateString) {
  if (!dateString) return null;
  return new Date(`${dateString}T00:00:00.000Z`);
}

