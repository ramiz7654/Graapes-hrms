import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { normalizeIndianMobile, resolveWorkLocation } from '../../lib/validators.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';
import { parseDateOnly } from '../../lib/dateUtils.js';
import { HttpError } from '../../utils/httpError.js';
import { nextEmployeeCode } from '../../lib/idSequence.js';
import { generateTemporaryPassword } from '../../lib/passwords.js';
import { sendCredentialEmail } from '../../lib/email.js';

/**
 * E-mails the credentials AFTER the database change is committed. Never throws, and the password is never logged.
 * Returns { status: 'sent' | 'failed' | 'not_configured', message, to }.
 */
async function emailCredentials(req, { employee, role, temporaryPassword }) {
  const result = await sendCredentialEmail({
    to: employee.workEmail,
    fullName: employee.fullName,
    role,
    email: employee.workEmail,
    temporaryPassword,
    employeeCode: employee.employeeCode,
  });
  await logAudit(req, {
    action: result.status === 'sent' ? 'CREDENTIAL_EMAIL_SENT' : 'CREDENTIAL_EMAIL_FAILED',
    entityType: 'Employee',
    entityId: employee.id,
    outcome: result.status === 'sent' ? 'SUCCESS' : 'FAILURE',
    comment: result.status === 'sent' ? `Sent to ${employee.workEmail}` : result.message,
  });
  return { ...result, to: employee.workEmail };
}

export function employeesRouter() {
  const router = Router();

  // GET /api/employees: List employees
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const { q = '', departmentId = '', status = '', managerOnly = 'false' } = req.query;

      // Build a mandatory access scope first, then AND user-supplied filters into it.
      // Never allow a search OR clause to overwrite or bypass role restrictions.
      let accessScope;
      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        accessScope = {};
      } else if (user.role === 'MANAGER') {
        const empId = user.employee?.id;
        accessScope = empId
          ? (managerOnly === 'true'
              ? { managerId: empId }
              : { OR: [{ managerId: empId }, { id: empId }] })
          : { id: '__no_employee_record__' };
      } else {
        accessScope = user.employee?.id
          ? { id: user.employee.id }
          : { id: '__no_employee_record__' };
      }

      const filters = [accessScope];
      if (q && typeof q === 'string' && q.trim()) {
        const term = q.trim().slice(0, 100);
        filters.push({ OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { employeeCode: { contains: term, mode: 'insensitive' } },
          { workEmail: { contains: term, mode: 'insensitive' } },
        ] });
      }
      if (departmentId) filters.push({ departmentId });
      if (status) filters.push({ status });
      const whereClause = { AND: filters };

      const employees = await prisma.employee.findMany({
        where: whereClause,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          manager: { select: { id: true, fullName: true, employeeCode: true } },
          userAccount: { select: { id: true, role: true, isActive: true, lastLoginAt: true } },
        },
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      });

      return res.json({
        employees: employees.map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          workEmail: e.workEmail,
          mobile: e.mobile,
          employmentType: e.employmentType,
          status: e.status,
          joiningDate: e.joiningDate ? e.joiningDate.toISOString().slice(0, 10) : null,
          workLocation: e.workLocation,
          department: e.department?.name || 'Unassigned',
          departmentId: e.departmentId,
          designation: e.designation?.title || 'Unassigned',
          designationId: e.designationId,
          manager: e.manager?.fullName || 'None',
          managerId: e.managerId,
          role: e.userAccount?.role || 'EMPLOYEE',
          accountActive: e.userAccount?.isActive ?? e.isActive,
          lastLoginAt: e.userAccount?.lastLoginAt,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/employees/:id: Details
  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          department: true,
          designation: true,
          // The manager's own manager is the Reporting HR for employees who report to a Manager.
          manager: { include: { manager: { select: { id: true, fullName: true, employeeCode: true } }, userAccount: { select: { role: true } } } },
          userAccount: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true } },
          history: { orderBy: { changedAt: 'desc' }, take: 10 },
        },
      });

      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }

      // Personal details are private: HR/Super Admin see everyone, a manager sees self + direct reports, others see only themselves.
      const viewer = req.user;
      const isSelf = viewer.employee?.id === employee.id;
      const isManagerOf = viewer.role === 'MANAGER' && viewer.employee?.id && employee.managerId === viewer.employee.id;
      if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(viewer.role) && !isSelf && !isManagerOf) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to view this profile.' } });
      }

      return res.json({ employee });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/employees: Create employee + user account
  router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const body = req.body || {};
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const role = body.role || 'EMPLOYEE';
      // Who may create which role: Super Admin -> HR / Manager / Employee. HR Admin -> Manager / Employee only.
      const creatable = req.user.role === 'SUPER_ADMIN' ? ['HR_ADMIN', 'MANAGER', 'EMPLOYEE'] : ['MANAGER', 'EMPLOYEE'];
      if (!['HR_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) {
        return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Choose HR, Manager or Employee.' } });
      }
      if (!creatable.includes(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not allowed to create this type of account.' } });
      }
      const employmentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(body.employmentType) ? body.employmentType : 'FULL_TIME';
      const joiningDateText = typeof body.joiningDate === 'string' && body.joiningDate ? body.joiningDate : new Date().toISOString().slice(0, 10);

      if (fullName.length < 2) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Full name is required (minimum 2 characters).' } });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'A valid email is required.' } });
      }

      const joiningDate = parseDateOnly(joiningDateText);

      // Check duplicate
      const [existingUser, existingEmp] = await Promise.all([
        prisma.userAccount.findUnique({ where: { email } }),
        prisma.employee.findUnique({ where: { workEmail: email } }),
      ]);

      if (existingUser || existingEmp) {
        return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account or employee already exists with this email.' } });
      }

      // Enforce active organization options on the server, not only in the UI.
      if (body.departmentId) {
        const department = await prisma.department.findUnique({ where: { id: body.departmentId } });
        if (!department || !department.isActive) return res.status(400).json({ error: { code: 'INACTIVE_DEPARTMENT', message: 'Choose an active department.' } });
      }
      if (body.designationId) {
        const designation = await prisma.designation.findUnique({ where: { id: body.designationId }, include: { department: true } });
        if (!designation || !designation.isActive || (designation.departmentId && (!designation.department?.isActive || designation.departmentId !== (body.departmentId || null)))) {
          return res.status(400).json({ error: { code: 'INVALID_DESIGNATION', message: 'Choose an active designation that matches the selected department.' } });
        }
      }

      // Validate reporting-line hierarchy on the server; UI filtering is not a security boundary.
      if (role === 'HR_ADMIN' && body.managerId) {
        return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: 'HR Admin must be independent or report at the Super Admin level.' } });
      }
      if (role === 'MANAGER') {
        if (!body.managerId) return res.status(400).json({ error: { code: 'REPORTING_MANAGER_REQUIRED', message: 'Select an HR Admin as reporting manager.' } });
        const manager = await prisma.employee.findFirst({ where: { id: body.managerId, isActive: true, userAccount: { role: 'HR_ADMIN', isActive: true } }, select: { id: true } });
        if (!manager) return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: 'A Manager must report to an active HR Admin.' } });
      }
      if (role === 'EMPLOYEE' && body.managerId) {
        const manager = await prisma.employee.findFirst({ where: { id: body.managerId, isActive: true, userAccount: { role: { in: ['HR_ADMIN', 'MANAGER'] }, isActive: true } }, select: { id: true } });
        if (!manager) return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: 'Employees may report only to an active HR Admin or Manager.' } });
      }

      const mobileCheck = normalizeIndianMobile(body.mobile);
      if (!mobileCheck.ok) return res.status(400).json({ error: { code: 'INVALID_MOBILE', message: mobileCheck.message } });
      const workLocation = await resolveWorkLocation(body.workLocation);
      if (!workLocation) return res.status(400).json({ error: { code: 'INVALID_LOCATION', message: 'Choose one of the company locations.' } });

      // Initial password (readable, no look-alike characters). The role-based ID is generated inside the transaction below.
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      const created = await prisma.$transaction(async (tx) => {
        const account = await tx.userAccount.create({
          data: {
            email,
            displayName: fullName,
            passwordHash,
            role,
            isActive: true,
          },
        });

        // Row-locked, permanent sequence: GRA-HR-0001 / GRA-MGR-0001 / GRA-EMP-0001 ...
        const employeeCode = await nextEmployeeCode(tx, role);

        const emp = await tx.employee.create({
          data: {
            employeeCode,
            fullName,
            workEmail: email,
            mobile: mobileCheck.value,
            workLocation,
            employmentType,
            joiningDate,
            departmentId: body.departmentId || null,
            designationId: body.designationId || null,
            managerId: body.managerId || null,
            userAccountId: account.id,
            isActive: true,
          },
          include: { department: true, designation: true, manager: true },
        });

        // Create opening ledger entries only for leave types explicitly configured by HR.
        // An unconfigured entitlement must not silently become a default allowance.
        const leaveTypes = await tx.leaveType.findMany({
          where: { isActive: true, annualAllowance: { not: null } },
        });
        const currentYear = joiningDate.getFullYear();
        for (const lt of leaveTypes) {
          await tx.leaveLedgerEntry.create({
            data: {
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year: currentYear,
              kind: 'OPENING',
              days: Number(lt.annualAllowance),
              note: 'Initial allocation from HR-configured annual allowance',
            },
          });
        }

        return emp;
      });

      await logAudit(req, {
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: created.id,
        after: { employeeCode: created.employeeCode, email: created.workEmail, role },
      });

      const emailResult = await emailCredentials(req, { employee: created, role, temporaryPassword });

      return res.status(201).json({
        message: 'Employee and login credentials created successfully.',
        email: emailResult,
        employee: created,
        credentials: {
          loginId: created.employeeCode,
          email,
          role,
          temporaryPassword,
          instruction: 'Share these login credentials securely with the employee.',
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: { code: 'DUPLICATE', message: 'An account with this email or ID already exists. Please try again.' } });
      }
      return next(error);
    }
  });

  // PATCH /api/employees/:id: Update employee details
  router.patch('/:id', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { userAccount: true },
      });

      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }

      const updateData = {};
      const allowed = ['fullName', 'mobile', 'workLocation', 'departmentId', 'designationId', 'managerId', 'employmentType', 'status'];

      for (const key of allowed) {
        if (body[key] !== undefined) {
          updateData[key] = body[key] === '' ? null : body[key];
        }
      }

      if (updateData.mobile !== undefined) {
        const mobileCheck = normalizeIndianMobile(updateData.mobile);
        if (!mobileCheck.ok) return res.status(400).json({ error: { code: 'INVALID_MOBILE', message: mobileCheck.message } });
        updateData.mobile = mobileCheck.value;
      }
      if (updateData.workLocation !== undefined) {
        const resolved = await resolveWorkLocation(updateData.workLocation);
        if (!resolved) return res.status(400).json({ error: { code: 'INVALID_LOCATION', message: 'Choose one of the company locations.' } });
        updateData.workLocation = resolved;
      }

      // Reporting line: HR -> Super Admin (no manager record), Manager -> HR, Employee -> Manager or HR.
      if (updateData.managerId !== undefined) {
        const targetRole = body.role || employee.userAccount?.role || 'EMPLOYEE';
        const nextManagerId = updateData.managerId || null;
        if (targetRole === 'HR_ADMIN' && nextManagerId) {
          return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: 'An HR Admin reports to the Super Admin and cannot have a reporting manager.' } });
        }
        if (nextManagerId) {
          if (nextManagerId === id) return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: 'An employee cannot report to themselves.' } });
          const manager = await prisma.employee.findFirst({
            where: { id: nextManagerId, isActive: true, status: { not: 'EXITED' }, userAccount: { role: { in: targetRole === 'MANAGER' ? ['HR_ADMIN'] : ['HR_ADMIN', 'MANAGER'] }, isActive: true } },
            select: { id: true },
          });
          if (!manager) {
            return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: targetRole === 'MANAGER' ? 'A manager must report to an active HR Admin.' : 'Choose an active HR Admin or Manager.' } });
          }
          // Walk up the chain: the new manager must not (directly or indirectly) report to this employee.
          let cursor = nextManagerId;
          for (let hop = 0; cursor && hop < 10; hop += 1) {
            const up = await prisma.employee.findUnique({ where: { id: cursor }, select: { managerId: true } });
            cursor = up?.managerId || null;
            if (cursor === id) return res.status(400).json({ error: { code: 'INVALID_REPORTING_MANAGER', message: 'This would create a reporting loop.' } });
          }
        }
        updateData.managerId = nextManagerId;
      }

      const nextDepartmentId = updateData.departmentId !== undefined ? updateData.departmentId : employee.departmentId;
      const nextDesignationId = updateData.designationId !== undefined ? updateData.designationId : employee.designationId;
      if (nextDepartmentId) {
        const department = await prisma.department.findUnique({ where: { id: nextDepartmentId } });
        if (!department || !department.isActive) return res.status(400).json({ error: { code: 'INACTIVE_DEPARTMENT', message: 'Choose an active department.' } });
      }
      if (nextDesignationId) {
        const designation = await prisma.designation.findUnique({ where: { id: nextDesignationId }, include: { department: true } });
        if (!designation || !designation.isActive || (designation.departmentId && (!designation.department?.isActive || designation.departmentId !== nextDepartmentId))) {
          return res.status(400).json({ error: { code: 'INVALID_DESIGNATION', message: 'Choose an active designation that matches the selected department.' } });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const emp = await tx.employee.update({
          where: { id },
          data: updateData,
          include: { department: true, designation: true, manager: true },
        });

        if (body.role && employee.userAccount) {
          // Block privilege escalation: only HR / Manager / Employee can be assigned here, and only Super Admin may make an HR.
          if (!['HR_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(body.role) || employee.userAccount.role === 'SUPER_ADMIN' || (body.role === 'HR_ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
            throw new HttpError(403, 'FORBIDDEN', 'You are not allowed to assign this role.');
          }
          await tx.userAccount.update({
            where: { id: employee.userAccount.id },
            data: { role: body.role },
          });
        }

        // Record history of changes (AC-03)
        const historyRows = [];
        for (const [field, newVal] of Object.entries(updateData)) {
          const oldVal = employee[field];
          if (String(oldVal || '') !== String(newVal || '')) {
            historyRows.push({
              employeeId: id,
              field,
              oldValue: oldVal ? String(oldVal) : null,
              newValue: newVal ? String(newVal) : null,
              changedById: req.user.employee?.id || req.user.id,
            });
          }
        }

        if (historyRows.length > 0) {
          await tx.employeeHistory.createMany({ data: historyRows });
        }

        return emp;
      });

      await logAudit(req, {
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: id,
        before: employee,
        after: updated,
      });

      return res.json({ message: 'Employee updated successfully.', employee: updated });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/employees/:id/deactivate: Deactivate account (BR-007)
  router.post('/:id/deactivate', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { userAccount: true },
      });

      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }

      const nextActive = !employee.isActive;

      await prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id },
          data: {
            isActive: nextActive,
            status: nextActive ? 'ACTIVE' : 'EXITED',
          },
        });

        if (employee.userAccountId) {
          await tx.userAccount.update({
            where: { id: employee.userAccountId },
            data: {
              isActive: nextActive,
              tokenVersion: { increment: 1 }, // instantly terminates session
            },
          });
        }
      });

      await logAudit(req, {
        action: nextActive ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
        entityType: 'Employee',
        entityId: id,
        after: { isActive: nextActive },
      });

      return res.json({
        message: nextActive ? 'Employee activated successfully.' : 'Employee deactivated and session revoked.',
        isActive: nextActive,
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/employees/:id/reset-password: issue a new temporary password (also clears a lockout)
  router.post(['/:id/reset-password', '/:id/resend-credentials'], requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const employee = await prisma.employee.findUnique({ where: { id: req.params.id }, include: { userAccount: true } });
      if (!employee || !employee.userAccount) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee or login account not found.' } });
      }
      const targetRole = employee.userAccount.role;
      if (targetRole === 'SUPER_ADMIN' || (req.user.role === 'HR_ADMIN' && targetRole === 'HR_ADMIN')) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot reset the password of this account.' } });
      }
      const temporaryPassword = generateTemporaryPassword();
      await prisma.userAccount.update({
        where: { id: employee.userAccount.id },
        data: { passwordHash: await bcrypt.hash(temporaryPassword, 12), failedLogins: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      });
      await logAudit(req, { action: 'PASSWORD_RESET', entityType: 'Employee', entityId: employee.id, after: { email: employee.workEmail } });
      // Also used by "Retry email": the old password is not stored (only its hash), so a retry issues a fresh one and mails that.
      const emailResult = await emailCredentials(req, { employee, role: targetRole, temporaryPassword });
      return res.json({
        message: 'New temporary password generated.',
        email: emailResult,
        credentials: { loginId: employee.employeeCode, email: employee.workEmail, role: targetRole, temporaryPassword, instruction: 'Share these credentials securely. The old password no longer works.' },
      });
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /api/employees/:id: PERMANENTLY delete an employee and everything linked to them (Super Admin only)
  router.delete('/:id', requireAuth, requireRoles('SUPER_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const employee = await prisma.employee.findUnique({ where: { id }, include: { userAccount: true } });
      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }
      if (employee.id === req.user.employee?.id || employee.userAccountId === req.user.id || employee.userAccount?.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'A Super Admin account cannot be deleted.' } });
      }

      // BR-007 (docs/database-design.md): HR history is retained, people are deactivated. Permanent deletion is therefore
      // only allowed for accounts with no real business history (e.g. created by mistake or for testing).
      const [punches, records, corrections, leaveRequests, documents, letters] = await Promise.all([
        prisma.attendancePunch.count({ where: { employeeId: id } }),
        prisma.attendanceRecord.count({ where: { employeeId: id } }),
        prisma.attendanceCorrection.count({ where: { employeeId: id } }),
        prisma.leaveRequest.count({ where: { employeeId: id } }),
        prisma.employeeDocument.count({ where: { employeeId: id } }),
        prisma.hRLetter.count({ where: { employeeId: id } }),
      ]);
      if (punches + records + corrections + leaveRequests + documents + letters > 0) {
        return res.status(409).json({ error: { code: 'HAS_HISTORY', message: 'This person has attendance, leave or document history that must be retained (BR-007). Use Deactivate instead of Delete.' } });
      }

      await prisma.$transaction(async (tx) => {
        // Detach other people from this employee (keep their records, just remove the link)
        await tx.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
        await tx.department.updateMany({ where: { headId: id }, data: { headId: null } });
        await tx.attendanceCorrection.updateMany({ where: { approverId: id }, data: { approverId: null } });
        await tx.leaveRequest.updateMany({ where: { approverId: id }, data: { approverId: null } });
        // Delete this employee's own records (children first)
        await tx.attendanceCorrection.deleteMany({ where: { employeeId: id } });
        await tx.attendancePunch.deleteMany({ where: { employeeId: id } });
        await tx.attendanceRecord.deleteMany({ where: { employeeId: id } });
        await tx.leaveLedgerEntry.deleteMany({ where: { employeeId: id } });
        await tx.leaveRequest.deleteMany({ where: { employeeId: id } });
        await tx.hRLetter.deleteMany({ where: { employeeId: id } });
        await tx.employeeDocument.deleteMany({ where: { employeeId: id } });
        await tx.employeeHistory.deleteMany({ where: { employeeId: id } });
        await tx.employee.delete({ where: { id } });
        if (employee.userAccountId) {
          await tx.notification.deleteMany({ where: { userId: employee.userAccountId } });
          await tx.userAccount.delete({ where: { id: employee.userAccountId } });
        }
      });

      await logAudit(req, {
        action: 'EMPLOYEE_DELETED',
        entityType: 'Employee',
        entityId: id,
        before: { employeeCode: employee.employeeCode, fullName: employee.fullName, email: employee.workEmail, role: employee.userAccount?.role },
      });
      return res.json({ message: 'Employee deleted permanently.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
