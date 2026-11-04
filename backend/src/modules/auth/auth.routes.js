import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { validateNewPassword } from '../../lib/passwords.js';
import { sendPasswordResetEmail } from '../../lib/email.js';

const COOKIE_NAME = 'graapes_session';
const ttlSeconds = Math.max(1, Number(env.SESSION_TTL_HOURS) || 8) * 60 * 60;
const sign = (value) => crypto.createHmac('sha256', env.SESSION_SECRET).update(value).digest('base64url');
const safeEqual = (a, b) => {
  const aa = Buffer.from(a || ''); const bb = Buffer.from(b || '');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};
function createToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}
function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra || !safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() || !payload.sub) return null;
    return payload;
  } catch { return null; }
}
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/', maxAge: ttlSeconds * 1000 });
const publicUser = (user) => ({ id: user.id, email: user.email, role: user.role, employeeId: user.employee?.id ?? null, employeeCode: user.employee?.employeeCode ?? null, fullName: user.employee?.fullName || user.displayName || (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.email.split('@')[0]) });

export function authRouter() {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      // The login box accepts either the work email or the generated employee ID (e.g. GRA-HR-0001).
      const identifier = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      // Temporary and chosen passwords never start/end with a space, so a stray space from copy-paste is ignored.
      const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
      if (!identifier || identifier.length > 254 || !password || password.length > 200) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your email or employee ID and password.' } });
      const user = identifier.includes('@')
        ? await prisma.userAccount.findUnique({ where: { email: identifier.toLowerCase() }, include: { employee: true } })
        : await prisma.userAccount.findFirst({ where: { employee: { is: { employeeCode: { equals: identifier, mode: 'insensitive' } } } }, include: { employee: true } });
      // Always do a bcrypt comparison to reduce email-enumeration timing differences.
      const dummyHash = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.3K4xG7GkRz0y5dJ9kG6qVx5Kj5G8M5e';
      const passwordOk = await bcrypt.compare(password, user?.passwordHash || dummyHash).catch(() => false);
      if (!user || !user.isActive || !user.passwordHash || !passwordOk || (user.lockedUntil && user.lockedUntil > new Date())) {
        if (user && user.isActive && (!user.lockedUntil || user.lockedUntil <= new Date())) {
          const failed = user.failedLogins + 1;
          await prisma.userAccount.update({ where: { id: user.id }, data: { failedLogins: failed, ...(failed >= 8 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), failedLogins: 0 } : {}) } });
        }
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email/ID or password is incorrect, or the account is temporarily locked.' } });
      }
      await prisma.userAccount.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
      const token = createToken({ sub: user.id, tv: user.tokenVersion, exp: Date.now() + ttlSeconds * 1000 });
      res.cookie(COOKIE_NAME, token, cookieOptions());
      return res.json({ user: publicUser(user) });
    } catch (error) { return next(error); }
  });

  // Request a password reset. The response intentionally does not reveal whether an account exists.
  router.post('/forgot-password', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const genericMessage = 'If an active account exists for that email, a password reset link will be sent shortly.';
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid email address.' } });
      }
      const user = await prisma.userAccount.findUnique({ where: { email }, include: { employee: true } });
      if (user && user.isActive) {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.userAccount.update({ where: { id: user.id }, data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } });
        const webUrl = env.WEB_APP_URL || env.WEB_ORIGIN;
        const resetUrl = `${webUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
        const fullName = user.employee?.fullName || user.displayName || (user.role === 'SUPER_ADMIN' ? 'Super Admin' : email.split('@')[0]);
        const result = await sendPasswordResetEmail({ to: user.email, fullName, resetUrl });
        if (result.status !== 'sent') {
          // Do not leave a usable reset token behind if delivery failed.
          await prisma.userAccount.update({ where: { id: user.id }, data: { passwordResetTokenHash: null, passwordResetExpiresAt: null } });
          if (env.NODE_ENV !== 'production') console.warn(`[password-reset] email delivery ${result.status}: ${result.message}`);
        }
      }
      return res.json({ message: genericMessage });
    } catch (error) { return next(error); }
  });

  router.post('/reset-password', async (req, res, next) => {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!token || token.length > 200) return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or expired. Request a new one.' } });
      const problem = validateNewPassword(newPassword);
      if (problem) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: problem } });
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await prisma.userAccount.findFirst({ where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() }, isActive: true } });
      if (!user) return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or expired. Request a new one.' } });
      await prisma.userAccount.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordResetTokenHash: null, passwordResetExpiresAt: null, failedLogins: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      });
      return res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
    } catch (error) { return next(error); }
  });

  router.get('/me', async (req, res, next) => {
    try {
      const payload = readToken(req.cookies?.[COOKIE_NAME]);
      if (!payload) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
      const user = await prisma.userAccount.findUnique({ where: { id: payload.sub }, include: { employee: true } });
      if (!user || !user.isActive || user.tokenVersion !== payload.tv) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired. Please sign in again.' } });
      return res.json({ user: publicUser(user) });
    } catch (error) { return next(error); }
  });

  async function currentAccount(req) {
    const payload = readToken(req.cookies?.[COOKIE_NAME]);
    if (!payload) return null;
    const user = await prisma.userAccount.findUnique({ where: { id: payload.sub }, include: { employee: { include: { department: true, designation: true, manager: true } } } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) return null;
    return user;
  }

  const profilePayload = (user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.employee?.fullName || user.displayName || (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.email.split('@')[0]),
    employee: user.employee ? {
      id: user.employee.id,
      employeeCode: user.employee.employeeCode,
      fullName: user.employee.fullName,
      workEmail: user.employee.workEmail,
      mobile: user.employee.mobile,
      personalAddress: user.employee.personalAddress,
      dateOfBirth: user.employee.dateOfBirth,
      employmentType: user.employee.employmentType,
      status: user.employee.status,
      joiningDate: user.employee.joiningDate,
      probationEndDate: user.employee.probationEndDate,
      workLocation: user.employee.workLocation,
      department: user.employee.department?.name || null,
      designation: user.employee.designation?.title || null,
      manager: user.employee.manager?.fullName || null,
      emergencyName: user.employee.emergencyName,
      emergencyRelation: user.employee.emergencyRelation,
      emergencyPhone: user.employee.emergencyPhone,
    } : {
      id: null,
      employeeCode: null,
      fullName: user.displayName || (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.email.split('@')[0]),
      workEmail: user.email,
      mobile: user.mobile,
      personalAddress: user.personalAddress,
      dateOfBirth: user.dateOfBirth,
      employmentType: null, status: null, joiningDate: null, probationEndDate: null,
      workLocation: null, department: null, designation: null, manager: null,
      emergencyName: null, emergencyRelation: null, emergencyPhone: null,
    },
  });

  router.get('/profile', async (req, res, next) => {
    try {
      const user = await currentAccount(req);
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      return res.json({ profile: profilePayload(user) });
    } catch (error) { return next(error); }
  });

  router.put('/profile', async (req, res, next) => {
    try {
      const user = await currentAccount(req);
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      const body = req.body || {};
      if (!user.employee) {
        const allowedAccount = ['fullName', 'mobile', 'personalAddress', 'dateOfBirth'];
        const accountData = {};
        for (const key of allowedAccount) {
          if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
          const value = body[key];
          if (value !== null && typeof value !== 'string') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `Invalid value for ${key}.` } });
          const clean = typeof value === 'string' ? value.trim() : null;
          if (clean && clean.length > (key === 'personalAddress' ? 1000 : 160)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `${key} is too long.` } });
          accountData[key === 'fullName' ? 'displayName' : key] = clean || null;
        }
        if (accountData.displayName !== undefined && (!accountData.displayName || accountData.displayName.length < 2)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your full name.' } });
        if (accountData.dateOfBirth) {
          const parsed = new Date(`${accountData.dateOfBirth}T00:00:00.000Z`);
          if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== accountData.dateOfBirth) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid date of birth.' } });
          accountData.dateOfBirth = parsed;
        }
        await prisma.userAccount.update({ where: { id: user.id }, data: accountData });
        const refreshedAccount = await prisma.userAccount.findUnique({ where: { id: user.id }, include: { employee: { include: { department: true, designation: true, manager: true } } } });
        return res.json({ message: 'Profile updated successfully.', profile: profilePayload(refreshedAccount) });
      }
      const allowed = ['fullName', 'mobile', 'personalAddress', 'dateOfBirth', 'workLocation', 'emergencyName', 'emergencyRelation', 'emergencyPhone'];
      const data = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          const value = body[key];
          if (value !== null && typeof value !== 'string') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `Invalid value for ${key}.` } });
          const clean = typeof value === 'string' ? value.trim() : null;
          if (clean && clean.length > (key === 'personalAddress' ? 1000 : 160)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `${key} is too long.` } });
          data[key] = clean || null;
        }
      }
      if (data.fullName !== undefined && (!data.fullName || data.fullName.length < 2)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your full name.' } });
      if (data.dateOfBirth) {
        const parsed = new Date(`${data.dateOfBirth}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data.dateOfBirth) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid date of birth.' } });
        data.dateOfBirth = parsed;
      }
      const before = user.employee;
      const updated = await prisma.employee.update({ where: { id: before.id }, data });
      const history = allowed.filter((key) => data[key] !== undefined && String(before[key] ?? '') !== String(updated[key] ?? '')).map((key) => ({ employeeId: before.id, field: key, oldValue: before[key] instanceof Date ? before[key].toISOString().slice(0, 10) : (before[key] == null ? null : String(before[key])), newValue: updated[key] instanceof Date ? updated[key].toISOString().slice(0, 10) : (updated[key] == null ? null : String(updated[key])) }));
      if (history.length) await prisma.employeeHistory.createMany({ data: history });
      const refreshed = await prisma.userAccount.findUnique({ where: { id: user.id }, include: { employee: { include: { department: true, designation: true, manager: true } } } });
      return res.json({ message: 'Profile updated successfully.', profile: profilePayload(refreshed) });
    } catch (error) { return next(error); }
  });



  // Employee directory and account provisioning (HR Admin / Super Admin only).
  router.get('/employees', async (req, res, next) => {
    try {
      const actor = await currentAccount(req);
      if (!actor) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      if (!['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(actor.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to the employee directory.' } });
      const where = actor.role === 'MANAGER' && actor.employee ? { managerId: actor.employee.id, isActive: true } : {};
      const employees = await prisma.employee.findMany({ where, orderBy: [{ createdAt: 'desc' }], include: { department: true, designation: true, manager: true, userAccount: { select: { email: true, isActive: true, role: true } } } });
      return res.json({ employees: employees.map((e) => ({ id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, email: e.workEmail, mobile: e.mobile, status: e.status, employmentType: e.employmentType, joiningDate: e.joiningDate, department: e.department?.name || null, designation: e.designation?.title || null, manager: e.manager?.fullName || null, accountActive: e.userAccount?.isActive ?? false })) });
    } catch (error) { return next(error); }
  });

  router.get('/organization-options', async (req, res, next) => {
    try {
      const actor = await currentAccount(req);
      if (!actor) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      const [departments, designations, managers] = await Promise.all([
        prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        prisma.designation.findMany({ where: { isActive: true, OR: [{ departmentId: null }, { department: { isActive: true } }] }, orderBy: { title: 'asc' }, select: { id: true, title: true, departmentId: true } }),
        prisma.employee.findMany({ where: { isActive: true, status: { not: 'EXITED' } }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, employeeCode: true } }),
      ]);
      return res.json({ departments, designations, managers });
    } catch (error) { return next(error); }
  });

  // Any signed-in user can change their own password (e.g. after receiving a temporary one).
  router.post('/change-password', async (req, res, next) => {
    try {
      const user = await currentAccount(req);
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!currentPassword) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your current password.' } });
      const problem = validateNewPassword(newPassword);
      if (problem) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: problem } });
      if (newPassword === currentPassword) return res.status(400).json({ error: { code: 'SAME_PASSWORD', message: 'The new password must be different from the current one.' } });

      const ok = user.passwordHash ? await bcrypt.compare(currentPassword, user.passwordHash).catch(() => false) : false;
      if (!ok) {
        const failed = user.failedLogins + 1;
        await prisma.userAccount.update({ where: { id: user.id }, data: { failedLogins: failed, ...(failed >= 8 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), failedLogins: 0 } : {}) } });
        return res.status(400).json({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect.' } });
      }

      // Bumping tokenVersion signs out every other session; this browser gets a fresh cookie so it stays signed in.
      const updated = await prisma.userAccount.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(newPassword, 12), failedLogins: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      });
      res.cookie(COOKIE_NAME, createToken({ sub: updated.id, tv: updated.tokenVersion, exp: Date.now() + ttlSeconds * 1000 }), cookieOptions());
      return res.json({ message: 'Password changed successfully.' });
    } catch (error) { return next(error); }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' });
    return res.json({ ok: true });
  });
  return router;
}

export function roleDashboard(role) {
  return ({ SUPER_ADMIN: '/dashboard/super-admin', HR_ADMIN: '/dashboard/hr-admin', MANAGER: '/dashboard/manager', EMPLOYEE: '/dashboard/employee', FINANCE: '/dashboard/super-admin' })[role] || '/login';
}
