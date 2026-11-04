# Database Design

Source of truth: `prisma/schema.prisma`. PostgreSQL, Prisma migrations.

## Entities

| Group | Models |
|---|---|
| Identity | `UserAccount` (login, role, active flag, `tokenVersion`, invite token hash, lockout) |
| Organization | `Department`, `Designation` |
| People | `Employee` (profile + employment + exit), `EmployeeHistory` (field-level change log) |
| Attendance | `AttendancePunch` (immutable raw punches), `AttendanceRecord` (daily summary), `AttendanceCorrection` (original + requested + decision) |
| Leave | `LeaveType`, `LeaveLedgerEntry` (append-only balance), `LeaveRequest`, `LeaveRequestEvent` (history) |
| Calendar | `Holiday` |
| Comms | `Announcement`, `AnnouncementAudience`, `Notification` |
| Files | `EmployeeDocument`, `HRLetter` |
| System | `OrganizationSetting` (key/value), `AuditLog` (append-only) |

## Key invariants

1. `Employee.employeeCode` is unique (BR-001). `Employee.workEmail` and `UserAccount.email` are unique.
2. `UserAccount` and `Employee` are separate and linked 1:1 (`Employee.userAccountId`). Super Admin may have no Employee.
3. **No hard deletes of HR history.** Relations to history use `onDelete: Restrict`; people are deactivated (`isActive=false`, `status=EXITED`), not removed (BR-007).
4. `AttendancePunch` rows are never updated. A correction creates new punches with `source=CORRECTION` and keeps `originalIn/originalOut` on the correction row (AC-07).
5. One `AttendanceRecord` per employee per company-local date (`@@unique([employeeId, date])`).
6. Leave balance = sum of `LeaveLedgerEntry.days` for (employee, type, year). Pending requests add a `PENDING_HOLD`; approval converts to `USED`; reject/cancel adds `RELEASE`. All inside one DB transaction.
7. `LeaveRequest.version` / `AttendanceCorrection.version` give optimistic concurrency so two approvers cannot both decide.
8. `AuditLog` has no update/delete code path; only HR/Super Admin can read it.
9. Files are stored by opaque `storageKey` outside any public folder; access goes through an authorized API route.
10. Dates without time (`@db.Date`) for joining, leave, holidays; timestamps in UTC.

## Deliberately not modelled

Payroll, salary, bank/PAN fields, recruitment, performance, assets (Later phases). Adding them later does not change existing tables.
