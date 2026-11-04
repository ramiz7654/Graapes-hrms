# Notification Read-State and Folder Structure Update

- Dynamic notifications now use a `NotificationReadState` database table keyed by user and notification ID.
- `PATCH /api/notifications/:id/read` persists individual dynamic notification read state.
- `POST /api/notifications/read-all` persists read state for currently generated dynamic alerts and marks saved notifications read.
- The shared `frontend/src/layouts/AppShell.jsx` marks a notification read when opened and is used across role dashboards, including Super Admin.
- The project folders are now top-level `backend/` and `frontend/`. Prisma remains in `prisma/` at the repository root.

Before running the updated application against an existing database, apply the migration and regenerate Prisma Client:

```bash
npm install
npm run db:deploy
npm run db:generate
```

A full frontend build and Prisma validation could not be completed in the editing environment because dependencies were not installed and the package registry was unavailable. Backend JavaScript syntax checks passed. Run the commands above in the project environment and test Mark Read / Mark All Read across logout-login and all role dashboards.
