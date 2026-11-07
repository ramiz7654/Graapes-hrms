# Dashboard redesign - 2026-11-07

## Dashboards (all four roles)
- Quick actions, "Organization & people", "Recent organization activity", HR "People management" / "Attendance and approvals",
  Employee "Self-service" / "Workplace information" / "Attendance snapshot", Manager "Team workflow" / "Manager actions" removed.
- New dependency-free SVG chart kit: `frontend/src/components/dashboard/charts.jsx`.
- "Upcoming holidays" is one big card containing a small card per holiday.
- Every dashboard now loads a single endpoint, `GET /api/dashboard/analytics` (it also contains the headline `stats`),
  so the stat cards and the charts always show the same numbers.

## Data scope (backend/src/modules/dashboard/dashboard.routes.js)
- SUPER_ADMIN: whole company. HR_ADMIN: own reporting tree. MANAGER: direct team only (manager's own record excluded).
- Any other role (EMPLOYEE, FINANCE): only their own data - FINANCE no longer receives company-wide analytics.
- Attendance status (present/late/absent/leave) is resolved in ONE function for cards, donut and trends.
- Birthdays / anniversaries are the next 30 days, not the whole month.
- Stat card labels, notes and icons corrected.

## User Management (EmployeeDirectory.jsx)
- Add HR: reporting manager fixed to "Super Admin (default)".
- Add Manager: reporting manager dropdown lists HR admins (name + ID).
- Add Employee: "Reporting Manager" (managers) + "Reporting HR" (auto-filled from the chosen manager; selectable only when no manager is chosen).
  The employee's `managerId` is the chosen manager, or the HR when no manager is chosen - no schema change.
- `/api/organization/options` now also returns each manager's `managerId`.

## Removed
- Unused `frontend/src/features/dashboard/DashboardPage.jsx`, empty `backend/src/modules/auth-placeholder.tmp`.

## Not changed
- Finance role / payroll (deliberately left out for now). Note: a FINANCE login still has no dashboard route.

## Batch 2 (2026-11-07): absence, locations, documents, visibility

- **Absent days**: derived at query time (no DB writes). Working day, from the day the employee record was created, no check-in, no approved leave, no holiday for the employee's location. Sat/Sun off by default (org setting `weeklyOffDays`). Today counts only after shift end.
- **Company Locations**: new `CompanyLocation` table (migration `20261107120000_company_locations`). Super Admin manages them in Organization. Holidays can target All Locations or one location; employee Work location is now a dropdown.
- **Confirm popups** are centered (`ConfirmDialog` / `useConfirm`).
- **Mobile**: fixed +91, 10 digits, validated in UI and backend.
- **Documents**: real upload from the local computer, stored in `backend/uploads/documents` (private, authenticated download).
- **Reporting line**: Super Admin can edit reporting manager / HR on the employee profile.
- **Visibility**: Manager sees only direct reports. HR Admin and Super Admin see all employees and all managers; dashboards, attendance and reporting-manager lists follow that scope.

Run after extracting: `npx prisma migrate deploy` and `npx prisma generate` (stop the dev server first on Windows).
