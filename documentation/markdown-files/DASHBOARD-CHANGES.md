# Role-specific dashboard content

All four dashboard routes use the same visual component and CSS to preserve the existing UI/UX, but the content is selected by role. HR Admin content has been kept unchanged.

- `/dashboard/super-admin`: company-wide summary, people overview, company-wide operations, user access/roles, reports, audit activity and system administration quick actions.
- `/dashboard/hr-admin`: unchanged HR operations dashboard for employee records, onboarding, attendance exceptions, leave administration and HR reports.
- `/dashboard/manager`: assigned team overview, team attendance/calendar, leave approvals, attendance corrections and team reports.
- `/dashboard/employee`: self-service only—own profile, attendance, leave/requests, announcements, holiday calendar and documents shared with the employee.

## Important
These are UI preview routes. Live statistics, authentication-based role resolution, real permissions, and backend enforcement are not implemented by this dashboard-content update. Hiding a section is not a security control. Other module pages may still be placeholders.
