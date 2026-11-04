# Requirements Matrix

Source: `Graapes_HRMS_BRD_v1.0.docx` (21 Oct 2026). Updated at the end of each day.

**Status legend:** `Not started` · `In progress` · `Built` (code exists) · `Verified` (tested, passing). Nothing is "Verified" until its test in the Test column has actually been run.

Day 1 result: foundation scaffolded (API health endpoint, DB schema, web shell). **Nothing below is Verified yet**, because packages could not be installed in the build sandbox (see `setup-and-run.md`). Run the Day 1 verification steps on your machine first.

## Functional requirements

| ID | Requirement | Priority | Module | Owner | Status | Test |
|---|---|---|---|---|---|---|
| FR-001 | Sign in / sign out | Must | auth | Dev 1 | Not started (Day 2) | api/auth.test, e2e login |
| FR-002 | Role + scope permissions | Must | auth/rbac | Dev 1 | Not started (Day 2) | api/permissions.test |
| FR-003 | Employee create/view/update/deactivate | Must | employees | Dev 1 | Schema only (Day 3) | api/employees.test |
| FR-004 | Unique employee ID | Must | employees | Dev 1 | Schema constraint only (Day 3) | duplicate-ID test |
| FR-005 | Departments, designations, managers | Must | organization | Dev 1 | Schema only (Day 3) | api/organization.test |
| FR-006 | Employment lifecycle fields | Must | employees | Dev 1 | Schema only (Day 3) | api/employees.test |
| FR-007 | Document upload/download with permissions | Must | documents | Dev 2 | Schema only (Day 6) | api/documents.test |
| FR-008 | Attendance check-in/out | Must | attendance | Dev 2 | Schema only (Day 4) | api/attendance.test |
| FR-009 | Attendance daily/monthly review, exceptions | Must | attendance | Dev 2 | Not started (Day 4) | api/attendance.test |
| FR-010 | Attendance corrections + approval | Must | attendance | Dev 2 | Schema only (Day 4) | api/corrections.test |
| FR-011 | Leave configuration | Must | leave | Dev 2 | Schema + 3 demo-default types (Day 5) | api/leave.test |
| FR-012 | Leave application + validation | Must | leave | Dev 2 | Schema only (Day 5) | api/leave.test |
| FR-013 | Leave approve/reject/clarify | Must | leave | Dev 2 | Schema only (Day 5) | api/leave.test |
| FR-014 | Leave balance + history | Must | leave | Dev 2 | Schema (ledger) only (Day 5) | api/leave.test |
| FR-015 | Holiday calendar | Must | holidays | Dev 1 | Schema only (Day 6) | api/holidays.test |
| FR-016 | Announcements | Should | announcements | Dev 1 | Schema only (Day 6) | api/announcements.test |
| FR-017 | Notifications (in-app) | Must | notifications | Dev 2 | Schema only (Day 5-6) | api/notifications.test |
| FR-018 | Role dashboards | Must | dashboard | Both | Not started (Day 6) | manual + e2e |
| FR-019 | Search and filters | Must | all lists | Both | Not started | per-module |
| FR-020 | Standard reports + export | Must | reports | Dev 1 | Not started (Day 6) | api/reports.test, download test |
| FR-021 | Audit trail | Must | audit | Dev 1 | Schema only (Day 3 onward) | api/audit.test |
| FR-022 | Payroll configuration | Later | n/a | n/a | Out of Phase 1; flag `payrollEnabled=false` seeded | AC-12 test |
| FR-023 | Recruitment | Later | n/a | n/a | Out of Phase 1 | n/a |
| FR-024 | Performance management | Later | n/a | n/a | Out of Phase 1 | n/a |
| FR-025 | Asset management | Later | n/a | n/a | Out of Phase 1 | n/a |

## Business rules

| ID | Rule | Where enforced | Status |
|---|---|---|---|
| BR-001 | Unique employee ID | DB unique index `Employee.employeeCode` + API check | Schema only |
| BR-002 | Only HR/Admin create/deactivate accounts | RBAC middleware | Day 2-3 |
| BR-003 | Employees edit only permitted fields | Field allow-list in employee service (list pending OQ-06) | Day 3 |
| BR-004 | Leave follows reporting hierarchy | Leave service, `approverId` from `managerId` | Day 5 |
| BR-005 | No self-approval | Leave/correction service; setting `allowSelfApproval=false` seeded | Day 4-5 |
| BR-006 | Decision history retained | `LeaveRequestEvent`, `AttendanceCorrection` rows | Schema only |
| BR-007 | Deactivated users lose access promptly | `tokenVersion` + `isActive` checked on every request | Day 2 |
| BR-008 | Exports respect permissions | Same service layer for screen and export | Day 6 |
| BR-009 | Company timezone (Asia/Kolkata) | `timezone` setting, UTC storage | Day 1 setting; usage Day 4 |
| BR-010 | Payroll controlled | Disabled | n/a |

## BRD acceptance criteria

| ID | Criterion | Day | Status | Test |
|---|---|---|---|---|
| AC-01 | Login shows only permitted menus/records | 2 | Not started | api + manual per role |
| AC-02 | HR creates employee; duplicate ID rejected | 3 | Not started | api/employees.test |
| AC-03 | Org change is auditable | 3 | Not started | api/audit.test |
| AC-04 | Employee submits leave, sees status | 5 | Not started | api/leave.test |
| AC-05 | Approver decides; employee notified; logged | 5 | Not started | api/leave.test |
| AC-06 | Attendance view by date range with exceptions | 4 | Not started | api/attendance.test |
| AC-07 | Correction keeps original + audit | 4 | Not started | api/corrections.test |
| AC-08 | Documents only for authorized users | 6 | Not started | api/documents.test |
| AC-09 | Reports/exports respect roles | 6 | Not started | api/reports.test |
| AC-10 | Deactivated accounts cannot sign in; history kept | 2-3 | Not started | api/auth.test |
| AC-11 | Key-actions report for a period | 6 | Not started | api/audit.test |
| AC-12 | Payroll unavailable unless enabled | 6 | Not started | api/settings.test |

## Master-prompt extras (from the project brief)

| Item | Day | Status |
|---|---|---|
| Light + dark theme, persisted, follows system | 1 | Built, not browser-verified |
| Layout preference Auto/Mobile/Desktop + mobile detection incl. Desktop-site mode | 1 | Built, **needs real phone testing** |
| Desktop sidebar + mobile bottom nav | 1 | Built, not browser-verified |
| Workplace name saved to DB and survives refresh | 6 | Setting row seeded; UI/API not started |
| Real CSV/Excel downloads | 6 | Not started |
| Safe Super Admin bootstrap (no default password) | 1 | Built in `prisma/seed.js`, not run |
| Invite-based onboarding (no public sign-up) | 2-3 | Schema fields only |
