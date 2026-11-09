import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

function audienceLabel(audiences = []) {
  if (!audiences.length || audiences.some((a) => a.type === 'ALL')) return 'All employees';
  const departments = audiences.filter((a) => a.type === 'DEPARTMENT').map((a) => a.department?.name).filter(Boolean);
  const designations = audiences.filter((a) => a.type === 'ROLE' && a.designationId).map((a) => a.designation?.title).filter(Boolean);
  const roles = audiences.filter((a) => a.type === 'ROLE' && !a.designationId && a.role).map((a) => a.role.replace('_', ' '));
  const parts = [];
  if (departments.length) parts.push(`Departments: ${departments.join(', ')}`);
  if (designations.length) parts.push(`Roles: ${designations.join(', ')}`);
  if (roles.length) parts.push(`Roles: ${roles.join(', ')}`);
  return parts.join(' · ') || 'All employees';
}

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
        include: { audiences: { include: { department: { select: { name: true } }, designation: { select: { title: true } } } } },
        orderBy: { createdAt: 'desc' },
      });

      const announcements = isAdmin ? allAnnouncements : allAnnouncements.filter((a) => {
        const audiences = a.audiences || [];
        if (!audiences.length || audiences.some((aud) => aud.type === 'ALL')) return true;
        return audiences.some((aud) => {
          if (aud.type === 'ROLE') {
            if (aud.designationId) return Boolean(user.employee?.designationId && aud.designationId === user.employee.designationId);
            return aud.role === user.role;
          }
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
          audience: audienceLabel(a.audiences),
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/announcements (Super Admin / HR Admin)
  // Body: { title, body, audienceType: 'ALL' | 'ROLE' | 'DEPARTMENT', designationIds?: [], departmentIds?: [] }
  //  - ROLE       -> one or more designations (empty list = all designations = everyone)
  //  - DEPARTMENT -> one or more departments (empty list = all departments = everyone)
  router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { title, body, audienceType = 'ALL' } = req.body || {};
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      const cleanBody = typeof body === 'string' ? body.trim() : '';
      if (!cleanTitle || !cleanBody) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Title and message body are required.' } });
      }
      if (!['ALL', 'DEPARTMENT', 'ROLE'].includes(audienceType)) {
        return res.status(400).json({ error: { code: 'INVALID_AUDIENCE', message: 'Choose all employees, a specific role or a specific department.' } });
      }
      const ids = (value) => [...new Set((Array.isArray(value) ? value : []).filter((v) => typeof v === 'string' && v))];

      let audiences = [{ type: 'ALL' }];
      if (audienceType === 'DEPARTMENT') {
        const departmentIds = ids(req.body.departmentIds ?? (req.body.departmentId ? [req.body.departmentId] : []));
        if (departmentIds.length) {
          const found = await prisma.department.findMany({ where: { id: { in: departmentIds }, isActive: true }, select: { id: true } });
          if (found.length !== departmentIds.length) return res.status(400).json({ error: { code: 'INVALID_AUDIENCE', message: 'One of the selected departments is not available.' } });
          audiences = departmentIds.map((departmentId) => ({ type: 'DEPARTMENT', departmentId }));
        }
      } else if (audienceType === 'ROLE') {
        const designationIds = ids(req.body.designationIds);
        if (designationIds.length) {
          const found = await prisma.designation.findMany({ where: { id: { in: designationIds }, isActive: true }, select: { id: true } });
          if (found.length !== designationIds.length) return res.status(400).json({ error: { code: 'INVALID_AUDIENCE', message: 'One of the selected designations is not available.' } });
          audiences = designationIds.map((designationId) => ({ type: 'ROLE', designationId }));
        }
      }

      const announcement = await prisma.announcement.create({
        data: {
          title: cleanTitle,
          body: cleanBody,
          status: 'PUBLISHED',
          publishAt: new Date(),
          createdById: req.user.id,
          audiences: { create: audiences },
        },
      });

      await logAudit(req, {
        action: 'ANNOUNCEMENT_PUBLISHED',
        entityType: 'Announcement',
        entityId: announcement.id,
        after: { title: announcement.title, audience: audienceType, targets: audiences.length },
      });

      return res.status(201).json({ announcement });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

