import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';

export function auditRouter() {
  const router = Router();

  // GET /api/audit (Super Admin and HR Admin only)
  router.get('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (_req, res, next) => {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return res.json({
        logs: logs.map((l) => ({
          id: l.id,
          actorEmail: l.actorEmail || 'System',
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          outcome: l.outcome,
          comment: l.comment,
          ip: l.ip,
          createdAt: l.createdAt,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

