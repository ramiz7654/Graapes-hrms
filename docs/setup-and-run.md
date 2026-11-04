# Setup and Run (Windows)

Do these steps once per developer machine. Use **PowerShell** or the VS Code terminal.

## 1. Install the tools

1. **Node.js 20 or newer (LTS)**: https://nodejs.org . Check: `node -v` and `npm -v`.
2. **PostgreSQL 16**: https://www.postgresql.org/download/windows/ . During install, remember the password you give the `postgres` user and keep port `5432`.
3. **Git**: https://git-scm.com/download/win . Check: `git --version`.
4. **VS Code** (optional but recommended).

## 2. Get the code

Dev 1 (once): create an empty private GitHub repo, then in the project folder:

```powershell
git add .
git commit -m "Day 1: project foundation"
git remote add origin https://github.com/YOUR-ORG/graapes-hrms.git
git push -u origin main
```

Dev 2:

```powershell
git clone https://github.com/YOUR-ORG/graapes-hrms.git
cd graapes-hrms
```

## 3. Create your `.env`

```powershell
copy .env.example .env
notepad .env
```

Edit these lines:

- `DATABASE_URL`: replace `CHANGE_ME` with your postgres password.
- `SESSION_SECRET`: paste the output of `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (12+ characters, your own choice).

`.env` is git-ignored. **Never** commit or share it.

## 4. Create the database

Open **SQL Shell (psql)** from the Start menu (press Enter for defaults, then your password) and run:

```sql
CREATE DATABASE graapes_hrms;
\q
```

## 5. Install, migrate, seed

```powershell
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

Expected: tables created, then `Seed complete. Super Admin account: ...`.

Commit the generated `prisma/migrations/` folder (Dev 1 only) so Dev 2 gets the same tables with `npm run db:deploy`.

## 6. Run

```powershell
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

Open http://localhost:5173/status. You should see API **Running** and Database **Connected**.

## 7. Check everything works

```powershell
npm test
npm run lint
npm run build
```

## Test on your phone (same Wi-Fi)

Run `npm run dev -w apps/web -- --host`, then open `http://YOUR-PC-IP:5173/status` on the phone (find the IP with `ipconfig`). Windows Firewall may ask to allow Node: allow on private networks. Note: the API calls go through the Vite proxy, so only the web port is needed.

## Common problems

| Message | Fix |
|---|---|
| `password authentication failed` | Wrong password in `DATABASE_URL` |
| `Can't reach database server` | PostgreSQL service not running: Start menu -> Services -> postgresql-x64-16 -> Start |
| `Invalid environment configuration` | Fix the listed variable in `.env` |
| `Port 4000/5173 already in use` | Close the other terminal, or change `API_PORT` |
| Status page says "Cannot reach the server" | API not running; check the `api` lines in the terminal |

## Two-developer Git routine

```powershell
git checkout main
git pull
git checkout -b feature/short-name      # e.g. feature/attendance-checkin
# ...work, then...
git add .
git commit -m "Attendance: check-in endpoint"
git push -u origin feature/short-name   # then open a Pull Request on GitHub
```

Rules: never commit to `main` directly · pull `main` before every new branch · one PR = one small thing · only Dev 1 edits `prisma/schema.prisma` · ask before touching shared files (`apps/api/src/app.js`, `apps/web/src/app/navigation.js`).

## Backup / restore (needed before any real deployment)

```powershell
pg_dump -U postgres -Fc graapes_hrms > backup.dump
pg_restore -U postgres -d graapes_hrms_restore backup.dump
```

Also back up the `storage/` folder (uploaded documents). Test a restore before go-live.
