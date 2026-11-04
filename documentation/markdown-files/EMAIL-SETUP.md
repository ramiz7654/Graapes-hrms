# Credential e-mails (Resend)

When a Super Admin or HR Admin creates a HR / Manager / Employee account, the Login ID, login e-mail and
temporary password are e-mailed automatically to the address typed in the form. The popup still shows the
same details, plus the e-mail result.

## Set up
1. Create an account at https://resend.com and create an **API key**.
2. Verify a sending **domain** in Resend (Domains). As far as I know, until a domain is verified Resend only lets the
   test sender deliver to the e-mail address of your own Resend account, so mails to other people fail with a 403.
3. Put these in the project root `.env` (never commit it, never share the key):
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxx
   EMAIL_FROM=Graapes HRMS <hrms@your-verified-domain.com>
   WEB_APP_URL=http://localhost:5173     # the live site URL after deployment
   ```
4. Restart the API (`npm run dev`). On Render, add the same three variables in Environment and redeploy.

No npm package is needed (the API uses Node's built-in `fetch`).

## What the popup shows
- **Sent**: green line "Credentials emailed to ...".
- **Failed / not configured**: a red box with the reason ("Email could not be sent") and a **Retry email** button. The account is
  already created either way.
- **Retry email** creates a NEW temporary password and e-mails that one (the old password is not stored anywhere, only its
  hash). The popup updates to show the new password. The old one stops working.

The same e-mail is sent when someone uses **Reset password** on a profile. Every attempt is written to the audit log
(`CREDENTIAL_EMAIL_SENT` / `CREDENTIAL_EMAIL_FAILED`); the password itself is never logged.

## Security notes
- A temporary password in an e-mail is only as private as that mailbox: tell people to change it at first login
  (My Profile, Change password).
- The API key lives only in `.env` on the server; the browser never sees it.
