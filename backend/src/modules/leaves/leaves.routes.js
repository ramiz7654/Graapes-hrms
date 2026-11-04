import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';
import { parseDateOnly } from '../../lib/dateUtils.js';

export function leavesRouter() {
  const router = Router();

  // GET /api/leave-types
  router.get('/types', requireAuth, async (_req, res, next) => {
    try {
      const types = await prisma.leaveType.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      return res.json({ types });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/leave-types (HR/Admin only)
  router.post('/types', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { name, code, isPaid = true, annualAllowance = null, allowHalfDay = false, requiresReason = false } = req.body || {};
      if (!name || !code) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name and Code are required.' } });
      }

      const created = await prisma.leaveType.create({
        data: {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          isPaid: Boolean(isPaid),
          annualAllowance: annualAllowance === null || annualAllowance === '' ? null : Number(annualAllowance),
          allowHalfDay: Boolean(allowHalfDay),
          requiresReason: Boolean(requiresReason),
        },
      });

      await logAudit(req, {
        action: 'LEAVE_TYPE_CREATED',
        entityType: 'LeaveType',
        entityId: created.id,
        after: created,
      });

      return res.status(201).json({ type: created });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/leaves/balances
  router.get('/balances', requireAuth, async (req, res, next) => {
    try {
      if (!req.user.employee) {
        return res.json({ balances: [] });
      }

      const employeeId = req.user.employee.id;
      const currentYear = new Date().getFullYear();

      const [leaveTypes, ledgerEntries] = await Promise.all([
        prisma.leaveType.findMany({ where: { isActive: true } }),
        prisma.leaveLedgerEntry.findMany({ where: { employeeId, year: currentYear } }),
      ]);

      const balances = leaveTypes.map((lt) => {
        const allowance = lt.annualAllowance == null ? null : Number(lt.annualAllowance);
        const used = ledgerEntries
          .filter((e) => e.leaveTypeId === lt.id && e.kind === 'USED')
          .reduce((sum, e) => sum + Number(e.days), 0);
        const credited = ledgerEntries
          .filter((e) => e.leaveTypeId === lt.id && ['OPENING', 'ACCRUAL', 'ADJUSTMENT'].includes(e.kind))
          .reduce((sum, e) => sum + Number(e.days), 0);

        const totalAvailable = credited > 0 ? (credited - used) : (allowance == null ? null : allowance - used);

        return {
          id: lt.id,
          code: lt.code,
          name: lt.name,
          allowance,
          used,
          available: totalAvailable == null ? null : Math.max(0, totalAvailable),
          isPaid: lt.isPaid,
          allowHalfDay: lt.allowHalfDay,
        };
      });

      return res.json({ balances });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/leaves: List requests
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const { scope = 'all' } = req.query; // 'own' | 'team' | 'all'

      let whereClause = {};

      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        if (scope === 'own' && user.employee) {
          whereClause = { employeeId: user.employee.id };
        } else {
          whereClause = {};
        }
      } else if (user.role === 'MANAGER') {
        const empId = user.employee?.id;
        if (scope === 'own') {
          whereClause = { employeeId: empId };
        } else {
          // Team approvals or all related
          whereClause = {
            OR: [
              { approverId: empId },
              { employee: { managerId: empId } },
              { employeeId: empId },
            ],
          };
        }
      } else {
        whereClause = { employeeId: user.employee?.id || 'none' };
      }

      const requests = await prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { id: true, fullName: true, employeeCode: true, department: { select: { name: true } } },
          },
          leaveType: {
            select: { id: true, name: true, code: true, isPaid: true },
          },
          approver: {
            select: { id: true, fullName: true },
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        requests: requests.map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          employeeName: r.employee?.fullName,
          employeeCode: r.employee?.employeeCode,
          department: r.employee?.department?.name || null,
          leaveType: r.leaveType?.name,
          leaveTypeCode: r.leaveType?.code,
          isPaid: r.leaveType?.isPaid,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate.toISOString().slice(0, 10),
          isHalfDay: r.isHalfDay,
          halfDayPart: r.halfDayPart,
          days: Number(r.days),
          reason: r.reason,
          status: r.status,
          approverName: r.approver?.fullName,
          createdAt: r.createdAt,
          canApprove:
            (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ||
              (user.role === 'MANAGER' && r.approverId === user.employee?.id)) &&
            r.employeeId !== user.employee?.id &&
            r.status === 'PENDING',
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/leaves: Apply for leave
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      if (user.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Super Admin cannot apply for leave.' } });
      }
      if (!user.employee) {
        return res.status(400).json({ error: { code: 'NO_EMPLOYEE_PROFILE', message: 'No employee record linked to your account.' } });
      }

      const { leaveTypeId, startDate, endDate, isHalfDay = false, halfDayPart, reason } = req.body || {};

      if (!leaveTypeId || !startDate || !endDate) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Leave type, start date, and end date are required.' } });
      }

      const start = parseDateOnly(startDate);
      const end = parseDateOnly(endDate);

      if (!start || !end || end < start) {
        return res.status(400).json({ error: { code: 'INVALID_DATES', message: 'End date must be on or after start date.' } });
      }

      // Check leave type
      const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
      if (!leaveType || !leaveType.isActive) {
        return res.status(400).json({ error: { code: 'INVALID_LEAVE_TYPE', message: 'Selected leave type is not active.' } });
      }

      if (leaveType.requiresReason && (!reason || reason.trim().length < 5)) {
        return res.status(400).json({ error: { code: 'REASON_REQUIRED', message: 'Reason is required for this leave type (minimum 5 characters).' } });
      }

      // Calculate days
      let days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (isHalfDay) {
        days = 0.5;
      }

      // Check overlapping pending/approved leaves
      const overlapping = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: user.employee.id,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            { startDate: { lte: end }, endDate: { gte: start } },
          ],
        },
      });

      if (overlapping) {
        return res.status(409).json({ error: { code: 'LEAVE_OVERLAP', message: 'You already have an active or pending leave request for overlapping dates.' } });
      }

      // Assign approver: manager first, or fallback to an HR_ADMIN
      let approverId = user.employee.managerId;
      if (!approverId) {
        const hrAdmin = await prisma.userAccount.findFirst({
          where: { role: 'HR_ADMIN', isActive: true, employee: { isNot: null } },
          include: { employee: true },
        });
        approverId = hrAdmin?.employee?.id || null;
      }

      const request = await prisma.$transaction(async (tx) => {
        const created = await tx.leaveRequest.create({
          data: {
            employeeId: user.employee.id,
            leaveTypeId,
            startDate: start,
            endDate: end,
            isHalfDay: Boolean(isHalfDay),
            halfDayPart: isHalfDay ? halfDayPart || 'FIRST_HALF' : null,
            days,
            reason: reason ? reason.trim() : null,
            approverId,
            status: 'PENDING',
          },
        });

        await tx.leaveRequestEvent.create({
          data: {
            leaveRequestId: created.id,
            actorId: user.employee.id,
            action: 'SUBMITTED',
            comment: reason ? reason.trim() : 'Applied for leave',
          },
        });

        return created;
      });

      await logAudit(req, {
        action: 'LEAVE_REQUESTED',
        entityType: 'LeaveRequest',
        entityId: request.id,
        after: { startDate, endDate, days, leaveTypeId },
      });

      return res.status(201).json({
        message: 'Leave application submitted successfully.',
        request,
      });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/leaves/:id/decision: Approve / Reject / Clarify
  router.patch('/:id/decision', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;
      const { status, comment } = req.body || {};

      if (!['APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED'].includes(status)) {
        return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Status must be APPROVED, REJECTED, or CLARIFICATION_REQUESTED.' } });
      }

      const request = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true, leaveType: true },
      });

      if (!request) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave request not found.' } });
      }

      // Rule BR-005: No self approval
      if (request.employeeId === user.employee?.id) {
        return res.status(403).json({ error: { code: 'SELF_APPROVAL_BLOCKED', message: 'You cannot approve or reject your own leave request.' } });
      }

      // Check authorization
      const isApprover = request.approverId === user.employee?.id;
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);
      if (!isApprover && !isAdmin) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorized to decide on this request.' } });
      }

      await prisma.$transaction(async (tx) => {
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status,
            updatedAt: new Date(),
          },
        });

        await tx.leaveRequestEvent.create({
          data: {
            leaveRequestId: id,
            actorId: user.employee?.id || user.id,
            action: status,
            comment: comment ? comment.trim() : null,
          },
        });

        // If approved, update ledger
        if (status === 'APPROVED') {
          await tx.leaveLedgerEntry.create({
            data: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year: request.startDate.getFullYear(),
              kind: 'USED',
              days: request.days,
              leaveRequestId: request.id,
              note: `Leave approved: ${request.startDate.toISOString().slice(0, 10)} to ${request.endDate.toISOString().slice(0, 10)}`,
              createdById: user.employee?.id || user.id,
            },
          });
        }
      });

      await logAudit(req, {
        action: `LEAVE_${status}`,
        entityType: 'LeaveRequest',
        entityId: id,
        after: { status, comment },
      });

      return res.json({ message: `Leave request ${status.toLowerCase()} successfully.` });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

