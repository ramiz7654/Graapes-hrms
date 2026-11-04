# Password Reset Changes
- Replaced the old Forgot password alert with a functional email request dialog.
- Added POST /api/auth/forgot-password and POST /api/auth/reset-password.
- Added a responsive reset-password page and route.
- Reset tokens are random, stored only as SHA-256 hashes, expire after 30 minutes, and are single-use.
- Successful reset updates the bcrypt password hash, clears failed login lockout, and increments tokenVersion to invalidate existing sessions.
- Added Prisma migration 0003_password_reset.
