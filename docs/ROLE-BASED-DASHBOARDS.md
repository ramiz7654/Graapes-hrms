# Graapes HRMS — Role-based dashboard plan

## Design decision
Use one shared dashboard shell and four role-specific dashboard views. Preserve the existing app shell, login page, sidebar styling, brand, theme provider, and responsive behavior. Role-specific navigation and data access must eventually be driven by the authenticated server session, not by a client-side selector.

## Current UI preview
The home route (`/`) now renders a role-based dashboard preview with a selector for Super Admin, HR Admin, Manager, and Employee. The selector is for reviewing the proposed layouts only; it is not authentication and does not grant or restrict permissions. Summary cards deliberately use `—` rather than fabricated business numbers until API data is connected.

## Super Admin
- Summary cards: total employees, present today, pending leave requests, departments.
- People overview: employee directory, organization structure, user access and role assignments.
- Operations/governance: attendance and leave, reports/exports, audit activity.
- Quick actions: employee directory, leave review, reports.
- Access: company-wide data and administrative controls, subject to backend authorization.

## HR Admin
- Summary cards: employees, present today, leave requests, upcoming holidays.
- People management: employee records, onboarding checklist, departments/designations.
- HR workflow: attendance exceptions, leave administration, HR reports.
- Quick actions: employee directory, leave, attendance.
- Access: HR data needed for assigned duties; sensitive pay and account-management access must be explicitly permissioned.

## Manager
- Summary cards: team members, present today, pending approvals, upcoming team leave.
- Team: assigned team directory, attendance exceptions, team calendar.
- Approvals: leave decisions, attendance corrections, authorized team summaries.
- Quick actions: pending leave, team attendance, team members.
- Access: assigned team only, enforced by API queries and authorization middleware.

## Employee
- Summary cards: own monthly attendance, leave balance, own requests in progress, next holiday.
- My details: profile, own attendance, own leave.
- Workplace updates: announcements, holidays, documents shared with the employee.
- Quick actions: own attendance, apply for leave, announcements.
- Access: self-service data only; private fields and other employees' records must be denied server-side.

## Implementation/security notes
- The UI selector is explicitly a preview aid and is not a real role switcher.
- Implement role resolution from the authenticated `/api/auth/me` response or equivalent server session.
- Filter sidebar items by role for usability, but never treat hidden navigation as a security boundary.
- Enforce access in every relevant Express endpoint; scope manager queries to assigned reports and employee queries to the current employee.
- Do not display made-up statistics. Replace `—` with API-derived values and provide loading/error/empty states.
- Dashboard cards and planned module descriptions are UI scaffolding. Existing placeholder pages elsewhere remain placeholders until separately implemented.
- Database/schema, `.env`, seed data, login flow and API behavior were not changed in this dashboard-only phase.
