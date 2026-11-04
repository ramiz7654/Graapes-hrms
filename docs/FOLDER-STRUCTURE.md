# Graapes HRMS clean project structure

## Frontend (`apps/web/src`)
- `components/dashboard/`: four role-specific JSX entry files plus one shared dashboard implementation and shared CSS. Existing dashboard styling/layout is reused; the role wrappers select the role content.
- `routes/AppRoutes.jsx`: central route definitions.
- `layouts/AppShell.jsx`: existing app shell, sidebar, header and responsive navigation.
- `app/navigation.js`: navigation registry.
- `pages/`: login page.
- `services/`: API client.
- `styles/`: global design tokens and base styling.

## Backend (`apps/api/src`)
- `modules/`: domain module boundaries.
- `middleware/`: request middleware and future authorization middleware.
- `routes/`: API route composition.
- `config/`: environment and service configuration.

## Database
- `prisma/schema.prisma` holds the Prisma schema. Database connectivity and migrations are intentionally not run as part of this UI package.

## Dashboard routes
- `/dashboard/super-admin`
- `/dashboard/hr-admin`
- `/dashboard/manager`
- `/dashboard/employee`

The root route `/` opens the Super Admin dashboard. Current role wrappers are UI previews, not authenticated role access. Backend authorization and live data must be implemented and tested before production use.
