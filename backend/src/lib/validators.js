import { prisma } from './prisma.js';

/**
 * Indian mobile numbers are stored as exactly 10 digits (the +91 prefix is fixed in the UI).
 * Accepts blank (-> null) and tolerates pasted forms such as "+91 98765-43210", "919876543210" or "09876543210".
 */
export function normalizeIndianMobile(value) {
  if (value === undefined || value === null) return { ok: true, value: null };
  let digits = String(value).replace(/[\s()-]/g, '');
  if (digits === '') return { ok: true, value: null };
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^\d{10}$/.test(digits)) return { ok: false, value: null, message: 'Enter a valid 10-digit mobile number (country code +91 is fixed).' };
  return { ok: true, value: digits };
}

/**
 * Resolve a work location NAME against the company's active locations.
 * Blank -> headquarters. Unknown -> null (caller answers 400).
 */
export async function resolveWorkLocation(name) {
  const wanted = typeof name === 'string' ? name.trim() : '';
  if (!wanted) {
    const hq = await prisma.companyLocation.findFirst({ where: { isActive: true, isHeadquarters: true } })
      || await prisma.companyLocation.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return hq ? hq.name : 'Headquarters';
  }
  const found = await prisma.companyLocation.findFirst({ where: { isActive: true, name: { equals: wanted, mode: 'insensitive' } } });
  return found ? found.name : null;
}
