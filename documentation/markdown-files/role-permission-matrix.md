# Role-Permission Matrix (draft, enforced in backend from Day 2)

Legend: **A** = all records · **T** = own team only (direct reports) · **O** = own record only · **-** = no access.
Scope rules are enforced in the service/query layer, not only in the UI.

| Capability | Super Admin | HR Admin | Manager | Employee/Intern |
|---|---|---|---|---|
| Sign in / out | yes | yes | yes | yes |
| Employees: view directory | A | A | T | O |
| Employees: create / edit / deactivate | - | A | - | edit permitted fields on O |
| Employee sensitive fields (emergency contact, exit) | - | A | - | O |
| Departments / designations manage | A | A | - | - |
| User accounts + roles administer | A | invite only | - | - |
| Attendance: own check-in/out + history | - | yes | yes | O |
| Attendance: view daily/monthly | A | A | T | O |
| Attendance correction: submit | - | O | O | O |
| Attendance correction: decide | - | A (fallback) | T | - (never own) |
| Leave types configure | A | A | - | - |
| Leave: apply / cancel own | - | O | O | O |
| Leave: decide | - | A (fallback) | T | - (never own) |
| Leave balances view / adjust | A view | A view+adjust | T view | O view |
| Holidays create/publish | A | A | - | view |
| Announcements create/publish | A | A | - | view targeted |
| Documents upload | - | A | - | O (if allowed) |
| Documents view/download | audited | A (audited) | - | O |
| HR letter records | - | A | - | O view |
| Reports (scoped like screens) | A | A | T (team) | O (own) |
| Exports (CSV/Excel) | A | A | T | O own data |
| Audit log view | A | limited (own area) | - | - |
| Organization settings (workplace name etc.) | A | - | - | - |
| Own preferences (theme, layout) | yes | yes | yes | yes |
| Payroll | disabled for everyone until enabled (OQ-07) | | | |

Notes
- Super Admin has no routine HR approval role; sensitive access is audited.
- A user can never approve their own request (BR-005), even if they are HR Admin or Manager.
- `Finance` role exists in the enum but has no Phase 1 permissions.
- Open points for HR confirmation: OQ-06, OQ-11, D-13, D-17.
