import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

async function buildDynamicAlerts(user) {
  const alerts = [];

  if (['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user.role)) {
    const pendingWhere = { status: 'PENDING' };
    if (user.role === 'MANAGER' && user.employee) {
      pendingWhere.approverId = user.employee.id;
    }

    const [pendingLeaves, latestLeave, pendingCorrections, latestCorrection] = await Promise.all([
      prisma.leaveRequest.count({ where: pendingWhere }),
      prisma.leaveRequest.findFirst({ where: pendingWhere, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true } }),
      prisma.attendanceCorrection.count({ where: pendingWhere }),
      prisma.attendanceCorrection.findFirst({ where: pendingWhere, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true } }),
    ]);

    if (pendingLeaves > 0) {
      alerts.push({
        id: `dyn-leaves-${pendingLeaves}-${latestLeave?.id || 'pending'}`,
        type: 'LEAVE_ACTION',
        title: 'Pending Leave Approvals',
        body: `You have ${pendingLeaves} pending leave ${pendingLeaves === 1 ? 'request' : 'requests'} awaiting your review.`,
        link: '/leave',
        createdAt: latestLeave?.createdAt || new Date(),
      });
    }

    if (pendingCorrections > 0) {
      alerts.push({
        id: `dyn-corrections-${pendingCorrections}-${latestCorrection?.id || 'pending'}`,
        type: 'ATTENDANCE_ACTION',
        title: 'Attendance Corrections',
        body: `You have ${pendingCorrections} attendance correction ${pendingCorrections === 1 ? 'request' : 'requests'} to action.`,
        link: '/attendance',
        createdAt: latestCorrection?.createdAt || new Date(),
      });
    }
  }

  const latestAnnouncement = await prisma.announcement.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
  });

  if (latestAnnouncement) {
    alerts.push({
      id: `dyn-ann-${latestAnnouncement.id}`,
      type: 'ANNOUNCEMENT',
      title: `Announcement: ${latestAnnouncement.title}`,
      body: latestAnnouncement.body.slice(0, 100) + (latestAnnouncement.body.length > 100 ? '…' : ''),
      link: '/announcements',
      createdAt: latestAnnouncement.createdAt,
    });
  }

  return alerts;
}

async function persistDynamicRead(userId, notificationKey) {
  await prisma.notificationReadState.upsert({
    where: { userId_notificationKey: { userId, notificationKey } },
    create: { userId, notificationKey, readAt: new Date() },
    update: { readAt: new Date() },
  });
}

export function notificationsRouter() {
  const router = Router();

  // GET /api/notifications. Dynamic alerts retain read state per user across navigation and sessions.
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const [dbNotifications, dynamicAlerts] = await Promise.all([
        prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
        buildDynamicAlerts(user),
      ]);

      const dynamicKeys = dynamicAlerts.map((n) => n.id);
      const readStates = dynamicKeys.length
        ? await prisma.notificationReadState.findMany({ where: { userId: user.id, notificationKey: { in: dynamicKeys } } })
        : [];
      const readAtByKey = new Map(readStates.map((state) => [state.notificationKey, state.readAt]));
      const persistedDynamic = dynamicAlerts.map((alert) => ({ ...alert, readAt: readAtByKey.get(alert.id) || null }));
      const notifications = [...persistedDynamic, ...dbNotifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.json({ notifications, unreadCount: notifications.filter((n) => !n.readAt).length });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/notifications/:id/read
  router.patch('/:id/read', requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (id.startsWith('dyn-')) {
        const currentAlerts = await buildDynamicAlerts(req.user);
        if (currentAlerts.some((alert) => alert.id === id)) {
          await persistDynamicRead(req.user.id, id);
        }
      } else {
        await prisma.notification.updateMany({
          where: { id, userId: req.user.id },
          data: { readAt: new Date() },
        });
      }
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/notifications/read-all
  router.post('/read-all', requireAuth, async (req, res, next) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      const dynamicAlerts = await buildDynamicAlerts(req.user);
      await Promise.all(dynamicAlerts.map((alert) => persistDynamicRead(req.user.id, alert.id)));
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
