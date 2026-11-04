# Graapes HRMS Portal — Team Handoff (latest packaged update)

This ZIP contains the latest packaged project update available as of 28 October 2026, including the existing HRMS UI, dashboard route previews, API scaffold, Prisma schema, and project documentation. It is a handoff baseline for the team, not a claim that all HRMS features or role-based security are complete.

## Requirements
- Node.js 20 or newer (LTS recommended)
- npm (comes with Node.js)
- A configured database if you need the API/database features

## Install dependencies
From the project root (`graapes-hrms/`):

```bash
npm install
npx prisma generate
```

## Configure environment
Copy `.env.example` to `.env` in the project root. Replace `DATABASE_URL` with your team's database connection string before using database-backed features. Do not commit `.env` or share real credentials in chat.

## Run the app
From the project root:

```bash
npm run dev
```

- Frontend (Vite): http://localhost:5173
- API: http://localhost:4000 (health endpoint: `/api/health`)

You can also run them separately:

```bash
npm run dev:web
npm run dev:api
```

## Build / test

```bash
npm run build
npm test
```

## Dashboard preview routes
- `/dashboard/super-admin`
- `/dashboard/hr-admin`
- `/dashboard/manager`
- `/dashboard/employee`

## Handoff notes / known limitations
- Dashboard routes are UI previews; role wrapper components currently reuse the shared `DashboardPage.jsx` design. They are not yet four fully independent dashboard implementations.
- These preview routes do not by themselves provide authentication or enforce role-based access control.
- API/database features require a valid `.env` and a reachable configured database.
- Do not run `npm run db:reset` on a real database; it can destroy data.
- Continue implementation against the BRD and docs in `docs/`.


## Local role login setup

See [LOGIN-QUICKSTART.md](LOGIN-QUICKSTART.md) for the one-time database seed command and development-only login credentials. Do not use those predictable credentials in production.
