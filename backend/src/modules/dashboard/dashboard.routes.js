import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getCompanyTodayDateString, parseDateOnly } from '../../lib/dateUtils.js';

export function dashboardRouter() {
  const router = Router();

  router.get('/stats', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const todayStr = getCompanyTodayDateString();
      const todayDate = parseDateOnly(todayStr);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-based
      const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
      const nextMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 1));

      // Base query counts
      const [totalEmployees, totalDepartments, activeAccounts, totalPendingLeaves, totalPendingCorrections] = await Promise.all([
        prisma.employee.count({ where: { isActive: true } }),
        prisma.department.count({ where: { isActive: true } }),
        prisma.userAccount.count({ where: { isActive: true } }),
        prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
        prisma.attendanceCorrection.count({ where: { status: 'PENDING' } }),
      ]);

      // Present today count
      const presentTodayCount = await prisma.attendanceRecord.count({
        where: {
          date: todayDate,
          status: { in: ['PRESENT', 'LATE'] },
        },
      });

      // Upcoming holidays
      const upcomingHolidays = await prisma.holiday.findMany({
        where: {
          date: { gte: todayDate },
          isPublished: true,
        },
        orderBy: { date: 'asc' },
        take: 3,
      });

      // Role-specific stats
      let stats = {};

      if (user.role === 'SUPER_ADMIN') {
        stats = {
          totalEmployees,
          departments: totalDepartments,
          activeAccounts,
          pendingAdminIssues: totalPendingLeaves + totalPendingCorrections,
        };
      } else if (user.role === 'HR_ADMIN') {
        stats = {
          totalEmployees,
          departments: totalDepartments,
          presentToday: presentTodayCount,
          pendingLeaves: totalPendingLeaves,
          pendingCorrections: totalPendingCorrections,
          upcomingHolidays: upcomingHolidays.length,
        };
      } else if (user.role === 'MANAGER') {
        const empId = user.employee?.id;
        if (empId) {
          const teamMemberIds = (
            await prisma.employee.findMany({
              where: { managerId: empId, isActive: true },
              select: { id: true },
            })
          ).map((e) => e.id);

          const [teamPresent, teamPendingLeaves, teamPendingCorrections] = await Promise.all([
            prisma.attendanceRecord.count({
              where: {
                employeeId: { in: teamMemberIds },
                date: todayDate,
                status: { in: ['PRESENT', 'LATE'] },
              },
            }),
            prisma.leaveRequest.count({
              where: {
                employeeId: { in: teamMemberIds },
                status: 'PENDING',
              },
            }),
            prisma.attendanceCorrection.count({
              where: {
                employeeId: { in: teamMemberIds },
                status: 'PENDING',
              },
            }),
          ]);

          stats = {
            teamMembers: teamMemberIds.length,
            teamPresentToday: teamPresent,
            pendingApprovals: teamPendingLeaves + teamPendingCorrections,
            upcomingTeamLeave: await prisma.leaveRequest.count({
              where: {
                employeeId: { in: teamMemberIds },
                status: 'APPROVED',
                startDate: { gte: todayDate },
              },
            }),
          };
        } else {
          stats = {
            teamMembers: 0,
            teamPresentToday: 0,
            pendingApprovals: 0,
            upcomingTeamLeave: 0,
          };
        }
      } else {
        // EMPLOYEE
        const empId = user.employee?.id;
        let monthlyAttendance = 0;
        let requestsInProgress = 0;
        let leaveBalance = 0;

        if (empId) {
          const [presentDays, pendingReqs, ledgerEntries, leaveTypes] = await Promise.all([
            prisma.attendanceRecord.count({
              where: {
                employeeId: empId,
                date: { gte: firstDayOfMonth, lt: nextMonth },
                status: { in: ['PRESENT', 'LATE'] },
              },
            }),
            prisma.leaveRequest.count({
              where: {
                employeeId: empId,
                status: 'PENDING',
              },
            }),
            prisma.leaveLedgerEntry.findMany({
              where: { employeeId: empId, year: currentYear },
            }),
            prisma.leaveType.findMany({ where: { isActive: true } }),
          ]);

          monthlyAttendance = presentDays;
          requestsInProgress = pendingReqs;

          // Compute balance from ledger or default allowance
          let totalBal = 0;
          for (const lt of leaveTypes) {
            const used = ledgerEntries
              .filter((e) => e.leaveTypeId === lt.id && e.kind === 'USED')
              .reduce((sum, e) => sum + Number(e.days), 0);
            const credited = ledgerEntries
              .filter((e) => e.leaveTypeId === lt.id && (e.kind === 'ACCRUAL' || e.kind === 'OPENING' || e.kind === 'ADJUSTMENT'))
              .reduce((sum, e) => sum + Number(e.days), 0);
            const allowance = lt.annualAllowance == null ? null : Number(lt.annualAllowance);
            const remaining = credited > 0 ? (credited - used) : (allowance == null ? null : allowance - used);
            if (remaining != null) totalBal += Math.max(0, remaining);
          }
          leaveBalance = totalBal;
        }

        const nextHoliday = upcomingHolidays[0];
        stats = {
          monthlyAttendance,
          leaveBalance,
          requestsInProgress,
          nextHoliday: nextHoliday ? `${nextHoliday.name} (${new Date(nextHoliday.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })})` : 'None upcoming',
        };
      }

      return res.json({ stats });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

