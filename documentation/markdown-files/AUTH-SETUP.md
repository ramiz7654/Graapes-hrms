# Graapes HRMS — first Super Admin login

## One-time setup on Windows

1. Keep your existing root `.env` file in the project folder. Do not share or upload it.
2. Confirm `DATABASE_URL` points to your intended Supabase/PostgreSQL database and `SESSION_SECRET` is a unique random string of at least 32 characters.
3. Double-click `setup-super-admin.bat`.
4. Enter the Super Admin email and choose a password of at least 12 characters when prompted. The password prompt is hidden; the password is not written into `.env` by this helper.
5. Once the script reports success, start the project as usual and open `http://localhost:5173/login`.

The existing Prisma seed script also creates the organization's base settings and default leave types. It uses bcrypt hashing for the Super Admin password. The helper does not run migrations or reset the database.

## Authentication included in this update

- `POST /api/auth/login` accepts email or employee code plus password.
- `GET /api/auth/me` restores the current signed-in account.
- `POST /api/auth/logout` clears the session cookie.
- Session cookie is HttpOnly, SameSite=Lax, and Secure in production.
- Failed passwords are counted; five failed attempts temporarily lock the account for 15 minutes.
- Session requests check account active status and `tokenVersion` against the database.
- Frontend dashboard routes require a session and role-specific dashboard routes check the role.

## Notes

- Do not manually insert a row into `UserAccount`: the password must be bcrypt-hashed.
- The first Super Admin is created from the existing `prisma/seed.js`; it is not created by a public signup endpoint.
- If an account already exists with the same email and a password hash, the seed is intentionally idempotent and will not overwrite its password. Use the existing password or arrange a deliberate password reset.
- The authentication endpoints and frontend wiring are implemented in this update, but the build/test runner could not complete in the authoring environment because the uploaded Windows `node_modules` did not contain Rollup's Linux optional binary. The changed JavaScript/JSX files passed syntax parsing and ESLint checks; database login was not end-to-end tested against your Supabase account.
