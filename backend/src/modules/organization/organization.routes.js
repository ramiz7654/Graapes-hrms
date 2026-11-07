import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

export function organizationRouter() {
  const router = Router();

  // GET /api/organization/options (used by employee forms)
  router.get('/options', requireAuth, async (req, res, next) => {
    try {
      const [departments, designations, managers, locations] = await Promise.all([
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
          where: { isActive: true, status: { not: 'EXITED' }, userAccount: { role: { in: ['HR_ADMIN', 'MANAGER'] }, isActive: true } },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, employeeCode: true, managerId: true, userAccount: { select: { role: true } } },
        }),
        prisma.companyLocation.findMany({ where: { isActive: true }, orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }], select: { id: true, name: true, city: true, state: true, isHeadquarters: true } }),
      ]);

      return res.json({ departments, designations, locations, managers: managers.map((m) => ({ ...m, role: m.userAccount?.role || 'EMPLOYEE' })) });
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

  // ---------------------------------------------------------------------------------------------
  // Company locations. Employee.workLocation / Holiday.location store the location NAME,
  // so a rename is cascaded to both tables inside one transaction.
  // ---------------------------------------------------------------------------------------------
  const RESERVED_LOCATION = 'all locations';
  const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

  async function locationUsage(name) {
    const [employees, holidays] = await Promise.all([
      prisma.employee.count({ where: { workLocation: name, isActive: true } }),
      prisma.holiday.count({ where: { location: name } }),
    ]);
    return { employees, holidays };
  }

  // GET /api/organization/locations
  router.get('/locations', requireAuth, async (_req, res, next) => {
    try {
      const locations = await prisma.companyLocation.findMany({ orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }] });
      const withUsage = await Promise.all(locations.map(async (l) => ({ ...l, usage: await locationUsage(l.name) })));
      return res.json({ locations: withUsage });
    } catch (error) { return next(error); }
  });

  // POST /api/organization/locations (Super Admin)
  router.post('/locations', requireAuth, requireRoles('SUPER_ADMIN'), async (req, res, next) => {
    try {
      const name = cleanText(req.body?.name, 80);
      const city = cleanText(req.body?.city, 80) || null;
      const state = cleanText(req.body?.state, 80) || null;
      const isHeadquarters = Boolean(req.body?.isHeadquarters);
      if (name.length < 2) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a location name (at least 2 characters).' } });
      if (name.toLowerCase() === RESERVED_LOCATION) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: '"All Locations" is reserved. Choose another name.' } });
      const existing = await prisma.companyLocation.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
      if (existing) return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'A location with this name already exists.' } });
      const location = await prisma.$transaction(async (tx) => {
        if (isHeadquarters) await tx.companyLocation.updateMany({ data: { isHeadquarters: false } });
        return tx.companyLocation.create({ data: { name, city, state, isHeadquarters, isActive: true } });
      });
      await logAudit(req, { action: 'LOCATION_CREATED', entityType: 'CompanyLocation', entityId: location.id, after: { name, city, state, isHeadquarters } });
      return res.status(201).json({ message: 'Location added.', location });
    } catch (error) { return next(error); }
  });

  // PATCH /api/organization/locations/:id (Super Admin): edit; a rename updates employees and holidays too.
  router.patch('/locations/:id', requireAuth, requireRoles('SUPER_ADMIN'), async (req, res, next) => {
    try {
      const location = await prisma.companyLocation.findUnique({ where: { id: req.params.id } });
      if (!location) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Location not found.' } });
      const body = req.body || {};
      const name = body.name !== undefined ? cleanText(body.name, 80) : location.name;
      const city = body.city !== undefined ? cleanText(body.city, 80) || null : location.city;
      const state = body.state !== undefined ? cleanText(body.state, 80) || null : location.state;
      const isHeadquarters = body.isHeadquarters !== undefined ? Boolean(body.isHeadquarters) : location.isHeadquarters;
      if (name.length < 2) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a location name (at least 2 characters).' } });
      if (name.toLowerCase() === RESERVED_LOCATION) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: '"All Locations" is reserved. Choose another name.' } });
      if (name.toLowerCase() !== location.name.toLowerCase()) {
        const clash = await prisma.companyLocation.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, NOT: { id: location.id } } });
        if (clash) return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'A location with this name already exists.' } });
      }
      if (location.isHeadquarters && !isHeadquarters) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Mark another location as headquarters instead of removing this one.' } });
      const updated = await prisma.$transaction(async (tx) => {
        if (isHeadquarters && !location.isHeadquarters) await tx.companyLocation.updateMany({ data: { isHeadquarters: false } });
        if (name !== location.name) {
          await tx.employee.updateMany({ where: { workLocation: location.name }, data: { workLocation: name } });
          await tx.holiday.updateMany({ where: { location: location.name }, data: { location: name } });
        }
        return tx.companyLocation.update({ where: { id: location.id }, data: { name, city, state, isHeadquarters } });
      });
      await logAudit(req, { action: 'LOCATION_UPDATED', entityType: 'CompanyLocation', entityId: location.id, before: { name: location.name, city: location.city, state: location.state, isHeadquarters: location.isHeadquarters }, after: { name, city, state, isHeadquarters } });
      return res.json({ message: 'Location updated.', location: updated });
    } catch (error) { return next(error); }
  });

  // PATCH /api/organization/locations/:id/status (Super Admin)
  router.patch('/locations/:id/status', requireAuth, requireRoles('SUPER_ADMIN'), async (req, res, next) => {
    try {
      const { isActive } = req.body || {};
      if (typeof isActive !== 'boolean') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'isActive must be true or false.' } });
      const location = await prisma.companyLocation.findUnique({ where: { id: req.params.id } });
      if (!location) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Location not found.' } });
      if (!isActive) {
        if (location.isHeadquarters) return res.status(409).json({ error: { code: 'HAS_DEPENDENCIES', message: 'The headquarters cannot be deactivated. Mark another location as headquarters first.' } });
        const usage = await locationUsage(location.name);
        if (usage.employees > 0) return res.status(409).json({ error: { code: 'HAS_DEPENDENCIES', message: `${usage.employees} active employee(s) work at this location. Move them to another location before deactivating it.` } });
      }
      const updated = await prisma.companyLocation.update({ where: { id: location.id }, data: { isActive } });
      await logAudit(req, { action: isActive ? 'LOCATION_ACTIVATED' : 'LOCATION_DEACTIVATED', entityType: 'CompanyLocation', entityId: location.id, before: { name: location.name, isActive: location.isActive }, after: { name: updated.name, isActive: updated.isActive } });
      return res.json({ message: `Location ${isActive ? 'activated' : 'deactivated'}.`, location: updated });
    } catch (error) { return next(error); }
  });

  // DELETE /api/organization/locations/:id (Super Admin): only when nothing references it.
  router.delete('/locations/:id', requireAuth, requireRoles('SUPER_ADMIN'), async (req, res, next) => {
    try {
      const location = await prisma.companyLocation.findUnique({ where: { id: req.params.id } });
      if (!location) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Location not found.' } });
      if (location.isHeadquarters) return res.status(409).json({ error: { code: 'HAS_DEPENDENCIES', message: 'The headquarters cannot be deleted.' } });
      const [employees, holidays] = await Promise.all([prisma.employee.count({ where: { workLocation: location.name } }), prisma.holiday.count({ where: { location: location.name } })]);
      if (employees > 0 || holidays > 0) return res.status(409).json({ error: { code: 'HAS_DEPENDENCIES', message: `Cannot delete: ${employees} employee(s) and ${holidays} holiday(s) use this location. Deactivate it instead, or move them first.` } });
      await prisma.companyLocation.delete({ where: { id: location.id } });
      await logAudit(req, { action: 'LOCATION_DELETED', entityType: 'CompanyLocation', entityId: location.id, before: { name: location.name } });
      return res.json({ message: 'Location deleted.' });
    } catch (error) { return next(error); }
  });

  return router;
}
