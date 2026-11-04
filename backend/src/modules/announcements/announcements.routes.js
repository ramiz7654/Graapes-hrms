import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

export function announcementsRouter() {
  const router = Router();

  // GET /api/announcements
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);

      const now = new Date();
      const whereClause = isAdmin
        ? {}
        : {
            status: 'PUBLISHED',
            publishAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          };

      const allAnnouncements = await prisma.announcement.findMany({
        where: whereClause,
        include: { audiences: true },
        orderBy: { createdAt: 'desc' },
      });

      const announcements = isAdmin ? allAnnouncements : allAnnouncements.filter((a) => {
        const audiences = a.audiences || [];
        if (!audiences.length || audiences.some((aud) => aud.type === 'ALL')) return true;
        return audiences.some((aud) => {
          if (aud.type === 'ROLE') return aud.role === user.role;
          if (aud.type === 'DEPARTMENT') {
            return Boolean(user.employee?.departmentId && aud.departmentId === user.employee.departmentId);
          }
          return false;
        });
      });

      return res.json({
        announcements: announcements.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          status: a.status,
          publishAt: a.publishAt,
          createdAt: a.createdAt,
          audience: a.audiences.length ? a.audiences[0].type : 'ALL',
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/announcements (HR/Admin)
  router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { title, body, audienceType = 'ALL', departmentId, role } = req.body || {};
      if (!title || !body) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Title and message body are required.' } });
      }
      if (!['ALL', 'DEPARTMENT', 'ROLE'].includes(audienceType)) {
        return res.status(400).json({ error: { code: 'INVALID_AUDIENCE', message: 'Choose ALL, DEPARTMENT, or ROLE.' } });
      }
      if (audienceType === 'DEPARTMENT' && !departmentId) {
        return res.status(400).json({ error: { code: 'INVALID_AUDIENCE', message: 'A department is required for department-targeted announcements.' } });
      }
      if (audienceType === 'ROLE' && !['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) {
        return res.status(400).json({ error: { code: 'INVALID_AUDIENCE', message: 'Choose a valid role for this announcement.' } });
      }

      const announcement = await prisma.announcement.create({
        data: {
          title: title.trim(),
          body: body.trim(),
          status: 'PUBLISHED',
          publishAt: new Date(),
          createdById: req.user.id,
          audiences: {
            create: {
              type: audienceType,
              departmentId: departmentId || null,
              role: role || null,
            },
          },
        },
      });

      await logAudit(req, {
        action: 'ANNOUNCEMENT_PUBLISHED',
        entityType: 'Announcement',
        entityId: announcement.id,
        after: { title: announcement.title },
      });

      return res.status(201).json({ announcement });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

