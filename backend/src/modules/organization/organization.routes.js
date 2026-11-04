import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

export function organizationRouter() {
  const router = Router();

  // GET /api/organization/options (used by employee forms)
  router.get('/options', requireAuth, async (_req, res, next) => {
    try {
      const [departments, designations, managers] = await Promise.all([
        prisma.department.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        }),
        prisma.designation.findMany({
          where: {
            isActive: true,
            OR: [{ departmentId: null }, { department: { isActive: true } }],
          },
          orderBy: { title: 'asc' },
          select: { id: true, title: true, departmentId: true },
        }),
        prisma.employee.findMany({
          where: { isActive: true, status: { not: 'EXITED' } },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, employeeCode: true },
        }),
      ]);

      return res.json({ departments, designations, managers });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/organization/departments
  router.get('/departments', requireAuth, async (_req, res, next) => {
    try {
      const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
          head: { select: { id: true, fullName: true } },
          _count: { select: { employees: true, designations: true } },
        },
      });

      return res.json({
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          headName: d.head?.fullName || null,
          headId: d.headId,
          employeeCount: d._count.employees,
          designationCount: d._count.designations,
          isActive: d.isActive,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/organization/departments (HR/Admin)
  router.post('/departments', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { name, code, headId } = req.body || {};
      if (!name || !code) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Department name and code are required.' } });
      }

      const existing = await prisma.department.findFirst({
        where: {
          OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
        },
      });

      if (existing) {
        return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Department with this name or code already exists.' } });
      }

      const department = await prisma.department.create({
        data: {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          headId: headId || null,
          isActive: true,
        },
      });

      await logAudit(req, {
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: department.id,
        after: department,
      });

      return res.status(201).json({ department });
    } catch (error) {
      return next(error);
    }
  });



  // PATCH /api/organization/departments/:id/status — activate/deactivate without deleting history.
  router.patch('/departments/:id/status', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { isActive } = req.body || {};
      if (typeof isActive !== 'boolean') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'isActive must be true or false.' } });
      const department = await prisma.department.findUnique({ where: { id: req.params.id } });
      if (!department) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found.' } });
      const updated = await prisma.department.update({ where: { id: department.id }, data: { isActive } });
      await logAudit(req, { action: isActive ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED', entityType: 'Department', entityId: department.id, before: { name: department.name, isActive: department.isActive }, after: { name: updated.name, isActive: updated.isActive } });
      return res.json({ message: `Department ${isActive ? 'activated' : 'deactivated'} successfully.`, department: updated });
    } catch (error) { return next(error); }
  });

  // DELETE /api/organization/departments/:id — permanent delete only when no references remain.
  router.delete('/departments/:id', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const department = await prisma.department.findUnique({ where: { id: req.params.id }, include: { _count: { select: { employees: true, designations: true } } } });
      if (!department) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found.' } });
      const headAssigned = Boolean(department.headId);
      if (department._count.employees > 0 || department._count.designations > 0 || headAssigned) {
        return res.status(409).json({ error: { code: 'HAS_DEPENDENCIES', message: `Cannot permanently delete this department: ${department._count.employees} employee(s), ${department._count.designations} designation(s)${headAssigned ? ', and a department head' : ''} are linked. Deactivate it instead or remove its dependencies first.` } });
      }
      await prisma.department.delete({ where: { id: department.id } });
      await logAudit(req, { action: 'DEPARTMENT_PERMANENTLY_DELETED', entityType: 'Department', entityId: department.id, before: { name: department.name, code: department.code, isActive: department.isActive } });
      return res.json({ message: 'Department permanently deleted.' });
    } catch (error) { return next(error); }
  });

  // GET /api/organization/designations
  router.get('/designations', requireAuth, async (_req, res, next) => {
    try {
      const designations = await prisma.designation.findMany({
        orderBy: { title: 'asc' },
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
      });

      return res.json({
        designations: designations.map((d) => ({
          id: d.id,
          title: d.title,
          departmentId: d.departmentId,
          departmentName: d.department?.name || 'All Departments',
          employeeCount: d._count.employees,
          isActive: d.isActive,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/organization/designations (HR/Admin)
  router.post('/designations', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { title, departmentId } = req.body || {};
      if (!title) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Designation title is required.' } });
      }

      if (departmentId) {
        const department = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!department || !department.isActive) return res.status(400).json({ error: { code: 'INACTIVE_DEPARTMENT', message: 'Choose an active department for this designation.' } });
      }

      const designation = await prisma.designation.create({
        data: {
          title: title.trim(),
          departmentId: departmentId || null,
          isActive: true,
        },
        include: { department: true },
      });

      await logAudit(req, {
        action: 'DESIGNATION_CREATED',
        entityType: 'Designation',
        entityId: designation.id,
        after: designation,
      });

      return res.status(201).json({ designation });
    } catch (error) {
      return next(error);
    }
  });


  // PATCH /api/organization/designations/:id/status — activate/deactivate.
  router.patch('/designations/:id/status', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { isActive } = req.body || {};
      if (typeof isActive !== 'boolean') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'isActive must be true or false.' } });
      const designation = await prisma.designation.findUnique({ where: { id: req.params.id }, include: { department: true } });
      if (!designation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Designation not found.' } });
      if (isActive && designation.departmentId && !designation.department?.isActive) return res.status(409).json({ error: { code: 'INACTIVE_DEPARTMENT', message: 'Activate the associated department before activating this designation.' } });
      const updated = await prisma.designation.update({ where: { id: designation.id }, data: { isActive } });
      await logAudit(req, { action: isActive ? 'DESIGNATION_ACTIVATED' : 'DESIGNATION_DEACTIVATED', entityType: 'Designation', entityId: designation.id, before: { title: designation.title, isActive: designation.isActive }, after: { title: updated.title, isActive: updated.isActive } });
      return res.json({ message: `Designation ${isActive ? 'activated' : 'deactivated'} successfully.`, designation: updated });
    } catch (error) { return next(error); }
  });

  // DELETE /api/organization/designations/:id — permanent delete only if no employee references it.
  router.delete('/designations/:id', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const designation = await prisma.designation.findUnique({ where: { id: req.params.id }, include: { _count: { select: { employees: true } } } });
      if (!designation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Designation not found.' } });
      if (designation._count.employees > 0) return res.status(409).json({ error: { code: 'HAS_DEPENDENCIES', message: `Cannot permanently delete this designation: ${designation._count.employees} employee(s) are assigned. Deactivate it instead or reassign those employees first.` } });
      await prisma.designation.delete({ where: { id: designation.id } });
      await logAudit(req, { action: 'DESIGNATION_PERMANENTLY_DELETED', entityType: 'Designation', entityId: designation.id, before: { title: designation.title, departmentId: designation.departmentId, isActive: designation.isActive } });
      return res.json({ message: 'Designation permanently deleted.' });
    } catch (error) { return next(error); }
  });

  return router;
}

