# Testing Checklist

Tick a box only after actually running it. Add date + initials.

## Day 1 verification (do on your Windows PC)

- [ ] `npm install` finishes without errors
- [ ] `npm run db:generate` succeeds
- [ ] `npm run db:migrate -- --name init` creates tables
- [ ] `npm run db:seed` prints "Seed complete"
- [ ] `npm test` -> 4 health tests pass
- [ ] `npm run lint` -> no errors
- [ ] `npm run build` succeeds
- [ ] `npm run dev`, open http://localhost:5173/status -> API "Running", Database "Connected"
- [ ] Stop PostgreSQL service -> Status page shows Database "Unreachable" (then start again)
- [ ] Theme: Light / System / Dark buttons change the **whole** app; refresh keeps the choice
- [ ] Layout buttons: Mobile shows bottom bar, Desktop shows sidebar, Auto follows screen
- [ ] Resize browser below 768 px in Auto -> mobile layout
- [ ] **Real phone** (Android Chrome + iPhone Safari), "Desktop site" ON, Auto layout -> mobile layout? Write the result on `/status` ("Detected as mobile device").

## The 20 acceptance scenarios (from the project brief)

Filled in as modules land; each needs an automated test or a written manual result.

| # | Scenario | Day | Result |
|---|---|---|---|
| 1 | Login shows only permitted menus/records/actions | 2 | |
| 2 | HR creates an employee | 3 | |
| 3 | Duplicate employee ID rejected | 3 | |
| 4 | Org change is auditable | 3 | |
| 5 | Employee submits leave, sees status | 5 | |
| 6 | Approver decides, requester notified | 5 | |
| 7 | Attendance by date range + exceptions | 4 | |
| 8 | Correction keeps original + audit | 4 | |
| 9 | Document access limited to authorized users | 6 | |
| 10 | Report filters/exports respect roles | 6 | |
| 11 | Deactivated account can't sign in; history kept | 2-3 | |
| 12 | Key actions/approvals report for a period | 6 | |
| 13 | Payroll unavailable until enabled | 6 | |
| 14 | Workplace name persists after refresh | 6 | |
| 15 | Exports are valid downloadable files | 6 | |
| 16 | Logout ends the session | 2 | |
| 17 | Mobile usable incl. desktop-mode phones | 7 | |
| 18 | Both themes legible and complete | 7 | |
| 19 | Loading/empty/success/validation/error states | 7 | |
| 20 | Clean setup reproducible from docs | 8 | |
