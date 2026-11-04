import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';
import { parseDateOnly } from '../../lib/dateUtils.js';

export function holidaysRouter() {
  const router = Router();

  // GET /api/holidays
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);

      const holidays = await prisma.holiday.findMany({
        where: isAdmin ? {} : { isPublished: true },
        orderBy: { date: 'asc' },
      });

      return res.json({
        holidays: holidays.map((h) => ({
          id: h.id,
          name: h.name,
          date: h.date.toISOString().slice(0, 10),
          location: h.location,
          isPublished: h.isPublished,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/holidays (HR/Admin)
  router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { name, date, location = 'All Locations', isPublished = true } = req.body || {};
      if (!name || !date) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name and date are required.' } });
      }

      const holidayDate = parseDateOnly(date);

      const holiday = await prisma.holiday.create({
        data: {
          name: name.trim(),
          date: holidayDate,
          location: location.trim(),
          isPublished: Boolean(isPublished),
        },
      });

      await logAudit(req, {
        action: 'HOLIDAY_CREATED',
        entityType: 'Holiday',
        entityId: holiday.id,
        after: holiday,
      });

      return res.status(201).json({ holiday });
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /api/holidays/:id (HR/Admin)
  router.delete('/:id', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      await prisma.holiday.delete({ where: { id } });

      await logAudit(req, {
        action: 'HOLIDAY_DELETED',
        entityType: 'Holiday',
        entityId: id,
      });

      return res.json({ message: 'Holiday deleted successfully.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

