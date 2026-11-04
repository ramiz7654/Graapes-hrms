# Attendance fixes — 2026-11-04

- Fixed the attendance UI mapping between API fields (`firstIn` / `lastOut`) and the UI (`checkIn` / `checkOut`). This was the cause of the status/time cards staying empty after a successful punch.
- My Attendance now requests the signed-in employee's own record for HR, Manager, and Employee accounts.
- Today's status and punch buttons derive from the saved check-in/check-out values.
- Working hours show the saved check-in-to-check-out duration; while checked in, elapsed time refreshes every 30 seconds.
- Improved check-in/check-out API error messages.
- Calendar markers now combine attendance, published holidays, approved leave, and pending leave, so overlapping events can each be marked.
- Today's date has a distinct outline/highlight. Added separate legend colors for approved leave and pending leave.
- No database schema change or migration is required.

Validation note: I could not complete the Vite production build in this environment because dependencies were not installed in the uploaded ZIP and `npm ci` timed out. Please run `npm ci` and `npm run build` locally before deployment.
