# Graapes HRMS - Source fixes applied (2026-11-04)

This package is a source-code remediation pass based on the uploaded ZIP and BRD. It is not a certification that the app is production-ready.

## Changes made

1. **Employee directory access scope** (`backend/src/modules/employees/employees.routes.js`)
   - Employees are scoped to their own employee record.
   - Managers are scoped to themselves and direct reports (or direct reports only when `managerOnly=true`).
   - Search, department, and status filters are ANDed with the role scope so search OR conditions cannot broaden access.
   - Missing employee records resolve to an impossible ID filter rather than a broad query.
2. **Reports access** (`backend/src/modules/reports/reports.routes.js`)
   - Company-wide summary is limited to Super Admin and HR Admin.
   - Employee, attendance, and leave reports are limited to Super Admin, HR Admin, and Manager.
   - Manager reports are scoped to self/direct reports, including the missing-employee case.
   - Unconfigured leave allowance is returned as `null`, not silently shown as 12.
3. **Leave entitlement defaults** (`backend/src/modules/leaves/leaves.routes.js`, `backend/src/modules/dashboard/dashboard.routes.js`, `backend/src/modules/employees/employees.routes.js`)
   - Removed silent default entitlements of 12/10 days.
   - Opening ledger entries are created only when HR has explicitly configured an annual allowance.
   - An unconfigured leave balance is represented as unknown/null instead of inventing an entitlement.
4. **Announcement audience filtering** (`backend/src/modules/announcements/announcements.routes.js`)
   - Non-admin users only receive published, currently active announcements that match ALL, their role, or their department.
   - Future-dated announcements are not shown before their publish time.
   - Invalid audience configuration is rejected.
5. **Dashboard KPI and status clarity** (`frontend/src/components/dashboard/DashboardPage.jsx`)
   - “My attendance” maps to the employee monthly attendance metric.
   - “Pending requests” maps to the employee requests-in-progress metric.
   - Dashboard cards no longer claim live data while loading or after an API failure.
   - The connection/status message now reflects API result state rather than claiming a live database connection unconditionally.
6. **Document metadata safety** (`backend/src/modules/documents/documents.routes.js`)
   - Removed fake PDF MIME type and invented file size records.
   - Upload endpoint now returns a clear 503 until secure file storage is configured; it does not create misleading metadata-only document records.

## Verification performed

- `node --check` passed for all API `.js` source files.
- Full dependency installation, Prisma validation/generation, frontend production build, integration tests, and live browser testing were not run in this environment.

## Known work still required before production

- Configure a real private object-storage provider and implement file upload/download, signed or authorized access, MIME/size validation, and sensitive-document audit logging.
- Add integration tests for role scoping, leave approvals/balances, attendance check-in/out and corrections, announcements, reports, and reset-password flow.
- Install dependencies and run `npm test`, `npm run lint`, `npm run build`, and `npx prisma validate` in the project environment.
- Test migration deployment against a backed-up staging database before production.
- Verify production HTTPS, cookie/security configuration, CORS/origin configuration, secret rotation, database backups and restore procedures.
- Perform browser tests for all four roles and mobile layout.

## Important

Do not run `prisma migrate reset` against a database with data you need. Back up the database before applying migrations.
