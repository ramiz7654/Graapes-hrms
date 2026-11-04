import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, logAudit } from '../../middleware/auth.js';
import { getCompanyTodayDateString, parseDateOnly } from '../../lib/dateUtils.js';

export function attendanceRouter() {
  const router = Router();

  // Helper to ensure user has an employee record
  const getEmployeeOrThrow = (user) => {
    if (!user.employee) {
      const err = new Error('No employee record linked to this account.');
      err.status = 400;
      throw err;
    }
    return user.employee;
  };

  // GET /api/attendance/today: current user's today status
  router.get('/today', requireAuth, async (req, res, next) => {
    try {
      if (!req.user.employee) {
        return res.json({ today: null, canPunch: false, reason: 'No employee record linked' });
      }
      const employeeId = req.user.employee.id;
      const todayStr = getCompanyTodayDateString();
      const todayDate = parseDateOnly(todayStr);

      const record = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: todayDate,
          },
        },
      });

      const punches = await prisma.attendancePunch.findMany({
        where: {
          employeeId,
          at: {
            gte: todayDate,
            lt: new Date(todayDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { at: 'asc' },
      });

      return res.json({
        date: todayStr,
        record: record
          ? {
              id: record.id,
              date: todayStr,
              firstIn: record.firstIn,
              lastOut: record.lastOut,
              status: record.status,
            }
          : null,
        punches,
        canPunchIn: !record?.firstIn,
        canPunchOut: Boolean(record?.firstIn && !record?.lastOut),
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/attendance: monthly and list view
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const month = Number(req.query.month) || new Date().getMonth() + 1;
      const year = Number(req.query.year) || new Date().getFullYear();
      const targetEmployeeId = req.query.employeeId;

      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));

      let whereClause = {
        date: { gte: startDate, lt: endDate },
      };

      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        if (targetEmployeeId) {
          whereClause.employeeId = targetEmployeeId;
        }
      } else if (user.role === 'MANAGER') {
        if (targetEmployeeId) {
          // Verify target reports to this manager
          const isReport = await prisma.employee.findFirst({
            where: { id: targetEmployeeId, managerId: user.employee?.id },
          });
          if (!isReport && targetEmployeeId !== user.employee?.id) {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only view your own or direct reports attendance.' } });
          }
          whereClause.employeeId = targetEmployeeId;
        } else {
          // Show own and team
          const team = await prisma.employee.findMany({
            where: { managerId: user.employee?.id, isActive: true },
            select: { id: true },
          });
          const ids = [user.employee?.id, ...team.map((t) => t.id)].filter(Boolean);
          whereClause.employeeId = { in: ids };
        }
      } else {
        // Regular employee
        if (!user.employee) return res.json({ records: [], summary: {} });
        whereClause.employeeId = user.employee.id;
      }

      const records = await prisma.attendanceRecord.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              workEmail: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { employee: { fullName: 'asc' } }],
      });

      const formatted = records.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee?.fullName,
        employeeCode: r.employee?.employeeCode,
        department: r.employee?.department?.name || null,
        date: r.date.toISOString().slice(0, 10),
        firstIn: r.firstIn,
        lastOut: r.lastOut,
        status: r.status,
      }));

      // Calculate summary
      const presentCount = formatted.filter((r) => ['PRESENT', 'LATE'].includes(r.status)).length;
      const missingPunchCount = formatted.filter((r) => r.status === 'MISSING_PUNCH' || (r.firstIn && !r.lastOut)).length;

      return res.json({
        records: formatted,
        summary: {
          totalDays: formatted.length,
          presentDays: presentCount,
          missingPunches: missingPunchCount,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/attendance/check-in
  router.post('/check-in', requireAuth, async (req, res, next) => {
    try {
      const employee = getEmployeeOrThrow(req.user);
      const todayStr = getCompanyTodayDateString();
      const todayDate = parseDateOnly(todayStr);
      const now = new Date();

      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: todayDate,
          },
        },
      });

      if (existing?.firstIn) {
        return res.status(400).json({ error: { code: 'ALREADY_CHECKED_IN', message: 'You have already checked in today.' } });
      }

      const result = await prisma.$transaction(async (tx) => {
        const punch = await tx.attendancePunch.create({
          data: {
            employeeId: employee.id,
            type: 'IN',
            at: now,
            source: 'WEB_SELF',
          },
        });

        const record = await tx.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: todayDate,
            },
          },
          update: {
            firstIn: now,
            status: 'PRESENT',
          },
          create: {
            employeeId: employee.id,
            date: todayDate,
            firstIn: now,
            status: 'PRESENT',
          },
        });

        return { punch, record };
      });

      await logAudit(req, {
        action: 'ATTENDANCE_CHECK_IN',
        entityType: 'AttendanceRecord',
        entityId: result.record.id,
        after: { firstIn: now, status: 'PRESENT' },
      });

      return res.json({
        message: 'Check-in recorded successfully.',
        record: {
          id: result.record.id,
          date: todayStr,
          firstIn: result.record.firstIn,
          lastOut: result.record.lastOut,
          status: result.record.status,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/attendance/check-out
  router.post('/check-out', requireAuth, async (req, res, next) => {
    try {
      const employee = getEmployeeOrThrow(req.user);
      const todayStr = getCompanyTodayDateString();
      const todayDate = parseDateOnly(todayStr);
      const now = new Date();

      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: todayDate,
          },
        },
      });

      if (!existing || !existing.firstIn) {
        return res.status(400).json({ error: { code: 'NOT_CHECKED_IN', message: 'Please check in before checking out.' } });
      }

      if (existing.lastOut) {
        return res.status(400).json({ error: { code: 'ALREADY_CHECKED_OUT', message: 'You have already checked out today.' } });
      }

      const result = await prisma.$transaction(async (tx) => {
        const punch = await tx.attendancePunch.create({
          data: {
            employeeId: employee.id,
            type: 'OUT',
            at: now,
            source: 'WEB_SELF',
          },
        });

        const record = await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            lastOut: now,
            status: 'PRESENT',
          },
        });

        return { punch, record };
      });

      await logAudit(req, {
        action: 'ATTENDANCE_CHECK_OUT',
        entityType: 'AttendanceRecord',
        entityId: result.record.id,
        after: { lastOut: now, status: 'PRESENT' },
      });

      return res.json({
        message: 'Check-out recorded successfully.',
        record: {
          id: result.record.id,
          date: todayStr,
          firstIn: result.record.firstIn,
          lastOut: result.record.lastOut,
          status: result.record.status,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/attendance/corrections: Request attendance correction
  router.post('/corrections', requireAuth, async (req, res, next) => {
    try {
      const employee = getEmployeeOrThrow(req.user);
      const { date, requestedIn, requestedOut, reason } = req.body || {};

      if (!date || !reason || reason.trim().length < 5) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid date and a clear reason (minimum 5 characters).' } });
      }

      const targetDate = parseDateOnly(date);
      if (!targetDate || Number.isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Invalid date provided.' } });
      }

      // Check existing record
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: targetDate,
          },
        },
      });

      // Parse requested times
      let parsedReqIn = null;
      let parsedReqOut = null;
      if (requestedIn) {
        parsedReqIn = new Date(`${date}T${requestedIn.length === 5 ? requestedIn + ':00' : requestedIn}`);
      }
      if (requestedOut) {
        parsedReqOut = new Date(`${date}T${requestedOut.length === 5 ? requestedOut + ':00' : requestedOut}`);
      }

      // Determine approver: manager first, or fallback to any HR_ADMIN
      let approverId = employee.managerId;
      if (!approverId) {
        const hrAdmin = await prisma.userAccount.findFirst({
          where: { role: 'HR_ADMIN', isActive: true, employee: { isNot: null } },
          include: { employee: true },
        });
        approverId = hrAdmin?.employee?.id || null;
      }

      const correction = await prisma.attendanceCorrection.create({
        data: {
          employeeId: employee.id,
          recordId: existingRecord?.id || null,
          date: targetDate,
          originalIn: existingRecord?.firstIn || null,
          originalOut: existingRecord?.lastOut || null,
          requestedIn: parsedReqIn,
          requestedOut: parsedReqOut,
          reason: reason.trim(),
          approverId,
          status: 'PENDING',
        },
      });

      await logAudit(req, {
        action: 'ATTENDANCE_CORRECTION_REQUESTED',
        entityType: 'AttendanceCorrection',
        entityId: correction.id,
        after: { date, reason: reason.trim() },
      });

      return res.status(201).json({
        message: 'Attendance correction submitted for approval.',
        correction,
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/attendance/corrections: List corrections
  router.get('/corrections', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      let whereClause = {};

      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        whereClause = {};
      } else if (user.role === 'MANAGER') {
        const empId = user.employee?.id;
        whereClause = {
          OR: [
            { approverId: empId },
            { employeeId: empId },
          ],
        };
      } else {
        whereClause = { employeeId: user.employee?.id || 'none' };
      }

      const corrections = await prisma.attendanceCorrection.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { id: true, fullName: true, employeeCode: true },
          },
          approver: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        corrections: corrections.map((c) => ({
          id: c.id,
          date: c.date.toISOString().slice(0, 10),
          employeeName: c.employee?.fullName,
          employeeCode: c.employee?.employeeCode,
          originalIn: c.originalIn,
          originalOut: c.originalOut,
          requestedIn: c.requestedIn,
          requestedOut: c.requestedOut,
          reason: c.reason,
          status: c.status,
          decisionComment: c.decisionComment,
          decidedAt: c.decidedAt,
          canApprove: ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) || (user.role === 'MANAGER' && c.approverId === user.employee?.id && c.employeeId !== user.employee?.id),
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/attendance/corrections/:id/decision
  router.patch('/corrections/:id/decision', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;
      const { status, decisionComment } = req.body || {};

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Status must be APPROVED or REJECTED.' } });
      }

      const correction = await prisma.attendanceCorrection.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!correction) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Correction request not found.' } });
      }

      // Check self-approval rule (BR-005)
      if (correction.employeeId === user.employee?.id) {
        return res.status(403).json({ error: { code: 'SELF_APPROVAL_BLOCKED', message: 'You cannot approve or reject your own correction request.' } });
      }

      // Check permission
      const isApprover = correction.approverId === user.employee?.id;
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);
      if (!isApprover && !isAdmin) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorized to decide on this request.' } });
      }

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.attendanceCorrection.update({
          where: { id },
          data: {
            status,
            decisionComment: decisionComment?.trim() || null,
            decidedById: user.employee?.id || user.id,
            decidedAt: now,
          },
        });

        if (status === 'APPROVED') {
          // Update AttendanceRecord
          await tx.attendanceRecord.upsert({
            where: {
              employeeId_date: {
                employeeId: correction.employeeId,
                date: correction.date,
              },
            },
            update: {
              firstIn: correction.requestedIn || correction.originalIn,
              lastOut: correction.requestedOut || correction.originalOut,
              status: 'PRESENT',
            },
            create: {
              employeeId: correction.employeeId,
              date: correction.date,
              firstIn: correction.requestedIn,
              lastOut: correction.requestedOut,
              status: 'PRESENT',
            },
          });

          // Add correction punches
          if (correction.requestedIn) {
            await tx.attendancePunch.create({
              data: {
                employeeId: correction.employeeId,
                type: 'IN',
                at: correction.requestedIn,
                source: 'CORRECTION',
              },
            });
          }
          if (correction.requestedOut) {
            await tx.attendancePunch.create({
              data: {
                employeeId: correction.employeeId,
                type: 'OUT',
                at: correction.requestedOut,
                source: 'CORRECTION',
              },
            });
          }
        }
      });

      await logAudit(req, {
        action: `ATTENDANCE_CORRECTION_${status}`,
        entityType: 'AttendanceCorrection',
        entityId: id,
        after: { status, decisionComment },
      });

      return res.json({ message: `Correction request ${status.toLowerCase()} successfully.` });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

