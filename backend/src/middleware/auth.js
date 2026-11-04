import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const COOKIE_NAME = 'graapes_session';

const sign = (value) => crypto.createHmac('sha256', env.SESSION_SECRET).update(value).digest('base64url');
const safeEqual = (a, b) => {
  const aa = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};

export function createSessionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra || !safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = readSessionToken(token);
    if (!payload) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    }

    const user = await prisma.userAccount.findUnique({
      where: { id: payload.sub },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            manager: true,
          },
        },
      },
    });

    if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired. Please sign in again.' } });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });
    }
    return next();
  };
}

export async function logAudit(req, { action, entityType, entityId, outcome = 'SUCCESS', before, after, comment }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        outcome,
        before: before ? JSON.parse(JSON.stringify(before)) : undefined,
        after: after ? JSON.parse(JSON.stringify(after)) : undefined,
        comment: comment || null,
        ip: req.ip || req.headers['x-forwarded-for'] || null,
      },
    });
  } catch (e) {
    console.error('Audit log write failed:', e.message);
  }
}

