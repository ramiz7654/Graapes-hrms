# Open Business Decisions

These come from BRD section 17 (OQ-01 to OQ-12). We do **not** invent policy. Each row lists what the code does until the client decides, and where the decision will be applied.

"Demo default" = a placeholder so the demo works. It is **not** client-approved and must be labelled as such in the demo.

| ID | Question | Owner | Demo default used meanwhile | Where it is configured |
|---|---|---|---|---|
| OQ-01 | Internal only or multi-company SaaS? | Management / Product | Single company (BRD section 6 assumption). No tenancy columns. | n/a (architecture) |
| OQ-02 | Employee/intern volume in 12 months | HR / Mgmt | Design for hundreds; server-side pagination everywhere | n/a |
| OQ-03 | Attendance method (manual, manager, GPS, biometric) | HR / Mgmt | Web self check-in/out only (`PunchSource.WEB_SELF`). No GPS, no biometric. | Setting `attendance.method` (Day 4) |
| OQ-04 | Working days/hours, grace, late, half-day | HR | **No late/half-day rules hardcoded.** Only: PRESENT (has IN+OUT), MISSING_PUNCH (one punch), ABSENT (none). LATE appears only after HR sets work start time + grace in Settings. | Settings: workStart, graceMinutes, workDays (Day 4) |
| OQ-05 | Leave types, accrual, carry-forward, approval levels | HR / Mgmt | 3 placeholder types (Casual, Sick, Unpaid) with **no entitlement** (`annualAllowance = NULL`). HR enters balances manually. Single approval level = reporting manager. | Leave Types screen + ledger adjustments (Day 5) |
| OQ-06 | Which profile fields can employees edit | HR | Employees may edit only mobile, address, emergency contact (placeholder list) | Field allow-list constant, later a setting (Day 3) |
| OQ-07 | Is payroll in Phase 1? | HR / Finance | **No.** `payrollEnabled=false`; no payroll screens or salary/bank fields. | Setting `payrollEnabled` |
| OQ-08 | Letter templates | HR | Letter **records** only (type, status, attached file). No generated legal text. | HR Letters (Day 6) |
| OQ-09 | Notification channels | HR / IT | In-app only. Email shows `NOT_CONFIGURED` until SMTP is supplied; never fake "sent". | `.env` SMTP_* |
| OQ-10 | Document types, size, retention | HR / IT / Mgmt | PDF/PNG/JPEG, 5 MB, soft delete only, no auto-purge | `.env` UPLOAD_* |
| OQ-11 | Who approves corrections, leave, data changes | HR / Mgmt | Reporting manager; HR Admin may act as fallback. Self-approval blocked (BR-005). | Approval routing in service layer |
| OQ-12 | Launch date, budget, hosting, support owner | Mgmt / IT | Local Windows demo only | `docs/setup-and-run.md` deployment notes |

## Additional decisions found while planning

| # | Question | Owner | Safe default |
|---|---|---|---|
| D-13 | Birthday/anniversary visibility (BRD 11) | HR | Visible to HR Admin only until HR decides |
| D-14 | Employment type list (BRD 7.1) | HR | FULL_TIME, PART_TIME, CONTRACT, INTERN (demo default) |
| D-15 | Session length | IT | 8 hours, setting `SESSION_TTL_HOURS` |
| D-16 | Pending-approval reminder cadence | HR | Off until configured |
| D-17 | Can a manager view a team member's leave type/reason? | HR | Dates + status only, not reason (privacy-first) |
