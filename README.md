# Graapes HRMS

Graapes HRMS is organized into separate `backend/` and `frontend/` folders while keeping Prisma schema/migrations and shared project configuration at the repository root.

## Folder structure

- `backend/` — Express API, authentication, HRMS modules, and API tests.
- `frontend/` — React + Vite application, dashboards, pages, components, and styles.
- `prisma/` — database schema, migrations, and seed script.
- `documentation/markdown-files/` — project notes and technical documentation.
- `.env` — local environment variables; copy `.env.example` and fill in real values. Never commit secrets.

## Install and run

Use Node.js 20 or later. From the repository root:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run dev
```

On Windows PowerShell, copy `.env.example` to `.env` manually if `cp` is unavailable. Configure `DATABASE_URL` and `SESSION_SECRET` in `.env` before running the API.

## Notification read-state update

Dynamic notifications now store per-user read state in `NotificationReadState`. Apply the new migration before starting the updated API:

```bash
npm run db:deploy
npm run db:generate
```

The shared application shell is used by Super Admin, HR Admin, Manager, and Employee roles, so the notification read-state behavior applies consistently across the dashboards.
