# Email update: what changed, file by file

Copy the files from this patch into your project at the same paths. If one of YOUR files has other changes you want
to keep (for example a forgot-password flow), do not overwrite it: apply only the small edit listed here instead.

## New files (safe to copy, nothing of yours is overwritten except email.js)
- `backend/src/lib/email.js`   (replaces the earlier unused version)
- `frontend/src/components/CredentialsDialog.jsx`

## Existing files with small edits
**`backend/src/config/env.js`**: inside the zod schema, after `COMPANY_TIMEZONE: ...,` add:
```js
  RESEND_API_KEY: z.string().trim().optional().transform((v) => v || undefined),
  EMAIL_FROM: z.string().trim().optional().transform((v) => v || undefined),
  WEB_APP_URL: z.string().trim().optional().transform((v) => v || undefined),
```
(Without this the keys are dropped by the schema and e-mail always says "not configured".)

**`backend/src/modules/employees/employees.routes.js`**
1. Add `import { sendCredentialEmail } from '../../lib/email.js';` with the other imports.
2. Add the `emailCredentials(req, {...})` helper function just above `export function employeesRouter()`.
3. In `POST /` (create): before `return res.status(201).json({`, add
   `const emailResult = await emailCredentials(req, { employee: created, role, temporaryPassword });` and add `email: emailResult,` to the JSON.
4. Reset password route: change `router.post('/:id/reset-password', ...` to `router.post(['/:id/reset-password', '/:id/resend-credentials'], ...`, and before its `return res.json({` add the same `emailResult` line and `email: emailResult,` in the JSON.

**`frontend/src/features/employees/EmployeeDirectory.jsx`**: import `CredentialsDialog`; change `setNewCredentials(res.credentials)` to
`setNewCredentials({ credentials: res.credentials, email: res.email, employeeId: res.employee?.id })`; replace the whole
"Generated Credentials Dialog" block with `<CredentialsDialog employeeId=... credentials=... email=... onClose=... />`.

**`frontend/src/features/employees/EmployeeProfile.jsx`**: same idea for the reset-password popup
(`setCredentials({ credentials: res.credentials, email: res.email })`).

**`.env.example`**: replace the `SMTP_*` lines with `RESEND_API_KEY=`, `EMAIL_FROM=`, `WEB_APP_URL=`.

Then add your real values to `.env` and restart the API (see `EMAIL-SETUP.md`).
