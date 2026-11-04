import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

export function settingsRouter() {
  const router = Router();

  // GET /api/settings
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const settingsRecords = await prisma.organizationSetting.findMany();
      const orgSettings = {};
      for (const row of settingsRecords) {
        orgSettings[row.key] = row.value;
      }

      // Default fallbacks if not yet initialized
      const defaults = {
        workplaceName: 'Graapes Private Limited',
        timezone: 'Asia/Kolkata',
        allowSelfApproval: false,
        payrollEnabled: false,
        workStart: '09:30',
        workEnd: '18:30',
        graceMinutes: 15,
      };

      const finalOrgSettings = { ...defaults, ...orgSettings };

      return res.json({
        organization: finalOrgSettings,
        userPreferences: {
          email: user.email,
          role: user.role,
          inAppNotifications: true,
          emailAlerts: false,
          themePreference: 'system',
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/settings: Update organization settings (Admins only)
  router.patch('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const body = req.body || {};
      const allowedKeys = [
        'workplaceName',
        'timezone',
        'allowSelfApproval',
        'workStart',
        'workEnd',
        'graceMinutes',
      ];

      const updated = {};
      for (const key of allowedKeys) {
        if (body[key] !== undefined) {
          await prisma.organizationSetting.upsert({
            where: { key },
            update: { value: body[key], updatedBy: req.user.email },
            create: { key, value: body[key], updatedBy: req.user.email },
          });
          updated[key] = body[key];
        }
      }

      await logAudit(req, {
        action: 'ORGANIZATION_SETTINGS_UPDATED',
        entityType: 'OrganizationSetting',
        after: updated,
      });

      return res.json({ message: 'Organization settings updated successfully.', settings: updated });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
