import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';

export function reportsRouter() {
  const router = Router();

  // Helper to convert array of objects to CSV string
  function jsonToCsv(headers, rows) {
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };
    const headerLine = headers.map((h) => escapeCsv(h.label)).join(',');
    const dataLines = rows.map((row) =>
      headers.map((h) => escapeCsv(row[h.key])).join(',')
    );
    return [headerLine, ...dataLines].join('\r\n');
  }

  // GET /api/reports/summary: High-level overview
  router.get('/summary', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { user } = req;
      const currentYear = new Date().getFullYear();

      // Scope check: manager only sees team, admin sees all
      let employeeScope = {};
      if (user.role === 'MANAGER' && user.employee) {
        employeeScope = {
          OR: [
            { managerId: user.employee.id },
            { id: user.employee.id },
          ],
        };
      }

      const [totalEmployees, activeEmployees, departments, leaveTypes, totalPunchesToday] =
        await Promise.all([
          prisma.employee.count({ where: employeeScope }),
          prisma.employee.count({ where: { ...employeeScope, status: 'ACTIVE' } }),
          prisma.department.findMany({
            include: { _count: { select: { employees: true } } },
          }),
          prisma.leaveType.findMany({ where: { isActive: true } }),
          prisma.attendanceRecord.count({
            where: {
              ...(user.role === 'MANAGER' && user.employee
                ? { employee: employeeScope }
                : {}),
              date: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
              status: { in: ['PRESENT', 'LATE'] },
            },
          }),
        ]);

      return res.json({
        summary: {
          totalEmployees,
          activeEmployees,
          presentToday: totalPunchesToday,
          departmentDistribution: departments.map((d) => ({
            name: d.name,
            code: d.code,
            headcount: d._count.employees,
          })),
          availableLeaveTypes: leaveTypes.map((lt) => ({
            name: lt.name,
            code: lt.code,
            annualAllowance: lt.annualAllowance == null ? null : Number(lt.annualAllowance),
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/reports/employees: Headcount report & export
  router.get('/employees', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const { user } = req;
      const { departmentId, status, format } = req.query;

      let whereClause = {};
      if (user.role === 'MANAGER') {
        whereClause = user.employee?.id
          ? { OR: [{ managerId: user.employee.id }, { id: user.employee.id }] }
          : { id: '__no_employee_record__' };
      }

      if (departmentId) whereClause.departmentId = departmentId;
      if (status) whereClause.status = status;

      const employees = await prisma.employee.findMany({
        where: whereClause,
        include: {
          department: true,
          designation: true,
          manager: true,
          userAccount: { select: { role: true, isActive: true } },
        },
        orderBy: [{ department: { name: 'asc' } }, { fullName: 'asc' }],
      });

      const data = employees.map((e) => ({
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        email: e.workEmail,
        department: e.department?.name || 'Unassigned',
        designation: e.designation?.title || 'Unassigned',
        manager: e.manager?.fullName || 'None',
        employmentType: e.employmentType,
        status: e.status,
        joiningDate: e.joiningDate ? e.joiningDate.toISOString().slice(0, 10) : '—',
        role: e.userAccount?.role || 'EMPLOYEE',
      }));

      if (format === 'csv') {
        const headers = [
          { key: 'employeeCode', label: 'Employee ID' },
          { key: 'fullName', label: 'Full Name' },
          { key: 'email', label: 'Work Email' },
          { key: 'department', label: 'Department' },
          { key: 'designation', label: 'Designation' },
          { key: 'manager', label: 'Reporting Manager' },
          { key: 'employmentType', label: 'Employment Type' },
          { key: 'status', label: 'Status' },
          { key: 'joiningDate', label: 'Joining Date' },
          { key: 'role', label: 'System Role' },
        ];
        const csv = jsonToCsv(headers, data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="employee-report.csv"');
        return res.send(csv);
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/reports/attendance: Attendance summary & export
  router.get('/attendance', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const { user } = req;
      const { month, year, departmentId, format } = req.query;

      const currentYear = Number(year) || new Date().getFullYear();
      const currentMonth = Number(month) || new Date().getMonth() + 1;
      const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
      const endDate = new Date(Date.UTC(currentYear, currentMonth, 1));

      let employeeFilter = {};
      if (user.role === 'MANAGER') {
        employeeFilter = user.employee?.id
          ? { OR: [{ managerId: user.employee.id }, { id: user.employee.id }] }
          : { id: '__no_employee_record__' };
      }
      if (departmentId) {
        employeeFilter.departmentId = departmentId;
      }

      const records = await prisma.attendanceRecord.findMany({
        where: {
          date: { gte: startDate, lt: endDate },
          employee: employeeFilter,
        },
        include: {
          employee: {
            include: { department: true },
          },
        },
        orderBy: [{ date: 'desc' }, { employee: { fullName: 'asc' } }],
      });

      const data = records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        employeeCode: r.employee?.employeeCode,
        fullName: r.employee?.fullName,
        department: r.employee?.department?.name || 'General',
        firstIn: r.firstIn ? new Date(r.firstIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
        lastOut: r.lastOut ? new Date(r.lastOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
        status: r.status,
      }));

      if (format === 'csv') {
        const headers = [
          { key: 'date', label: 'Date' },
          { key: 'employeeCode', label: 'Employee ID' },
          { key: 'fullName', label: 'Full Name' },
          { key: 'department', label: 'Department' },
          { key: 'firstIn', label: 'Check In' },
          { key: 'lastOut', label: 'Check Out' },
          { key: 'status', label: 'Attendance Status' },
        ];
        const csv = jsonToCsv(headers, data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${currentYear}-${currentMonth}.csv"`);
        return res.send(csv);
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/reports/leaves: Leave application report & export
  router.get('/leaves', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), async (req, res, next) => {
    try {
      const { user } = req;
      const { year, status, format } = req.query;
      const currentYear = Number(year) || new Date().getFullYear();

      let employeeFilter = {};
      if (user.role === 'MANAGER') {
        employeeFilter = user.employee?.id
          ? { OR: [{ managerId: user.employee.id }, { id: user.employee.id }] }
          : { id: '__no_employee_record__' };
      }

      const requests = await prisma.leaveRequest.findMany({
        where: {
          startDate: {
            gte: new Date(Date.UTC(currentYear, 0, 1)),
            lt: new Date(Date.UTC(currentYear + 1, 0, 1)),
          },
          ...(status ? { status } : {}),
          employee: employeeFilter,
        },
        include: {
          employee: { include: { department: true } },
          leaveType: true,
          approver: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = requests.map((r) => ({
        id: r.id,
        employeeCode: r.employee?.employeeCode,
        fullName: r.employee?.fullName,
        department: r.employee?.department?.name || 'General',
        leaveType: r.leaveType?.name,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        days: Number(r.days),
        reason: r.reason || '—',
        status: r.status,
        approver: r.approver?.fullName || 'HR Admin',
        appliedOn: r.createdAt.toISOString().slice(0, 10),
      }));

      if (format === 'csv') {
        const headers = [
          { key: 'appliedOn', label: 'Applied Date' },
          { key: 'employeeCode', label: 'Employee ID' },
          { key: 'fullName', label: 'Full Name' },
          { key: 'department', label: 'Department' },
          { key: 'leaveType', label: 'Leave Type' },
          { key: 'startDate', label: 'Start Date' },
          { key: 'endDate', label: 'End Date' },
          { key: 'days', label: 'Total Days' },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status' },
          { key: 'approver', label: 'Approver' },
        ];
        const csv = jsonToCsv(headers, data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="leaves-report-${currentYear}.csv"`);
        return res.send(csv);
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
