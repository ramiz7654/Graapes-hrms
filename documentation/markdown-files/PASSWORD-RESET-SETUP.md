# Forgot Password Setup

The login page now supports email-based password reset.

## How it works
1. On the login page, choose **Forgot password?** and enter the account's work email.
2. If an active account exists and email delivery is configured, the user receives a reset link.
3. The link expires in 30 minutes and can be used once.
4. After a successful reset, all previously issued sessions are invalidated and the user can sign in with the new password.

## Required configuration
Set these values in the repository-root `.env` file (never commit real secrets):

- `RESEND_API_KEY`: valid Resend API key
- `EMAIL_FROM`: sender address/domain allowed by Resend
- `WEB_APP_URL`: base URL users open in their browser, e.g. `http://localhost:5173` during local development or the deployed HTTPS site URL
- `DATABASE_URL`: PostgreSQL connection string

The app intentionally displays a generic response whether or not an account exists, to avoid exposing registered email addresses. If email delivery is not configured or fails, no active reset token is retained.

## Apply the database change
Run these commands from the repository root after installing dependencies and configuring `.env`:

```bash
npx prisma migrate deploy
npx prisma generate
```

Do **not** run `prisma migrate reset`; it can erase database data.
