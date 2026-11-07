import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';
import { parseDateOnly } from '../../lib/dateUtils.js';
import { ALL_LOCATIONS, holidayLocationWhere, isAllLocations } from '../../lib/attendanceCalendar.js';

export function holidaysRouter() {
  const router = Router();

  // GET /api/holidays
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);

      // Admins see every holiday. Everyone else sees only holidays for "All Locations" and their own work location.
      const holidays = await prisma.holiday.findMany({
        where: isAdmin ? {} : { isPublished: true, ...holidayLocationWhere(user.employee?.workLocation) },
        orderBy: { date: 'asc' },
      });

      return res.json({
        holidays: holidays.map((h) => ({
          id: h.id,
          name: h.name,
          date: h.date.toISOString().slice(0, 10),
          location: isAllLocations(h.location) ? ALL_LOCATIONS : h.location,
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
      const { name, date, location, isPublished = true } = req.body || {};
      if (!name || !date) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name and date are required.' } });
      }

      // "All Locations" or the name of an active company location - nothing else.
      let holidayLocation = ALL_LOCATIONS;
      if (!isAllLocations(location)) {
        const company = await prisma.companyLocation.findFirst({ where: { name: String(location).trim(), isActive: true } });
        if (!company) return res.status(400).json({ error: { code: 'INVALID_LOCATION', message: 'Choose "All Locations" or one of the company locations.' } });
        holidayLocation = company.name;
      }

      const holidayDate = parseDateOnly(date);

      let holiday;
      try {
        holiday = await prisma.holiday.create({
          data: {
            name: name.trim(),
            date: holidayDate,
            location: holidayLocation,
            isPublished: Boolean(isPublished),
          },
        });
      } catch (error) {
        if (error?.code === 'P2002') {
          return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'A holiday with this name already exists on that date. Use a different name (for example "Pongal - Tamil Nadu").' } });
        }
        throw error;
      }

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

