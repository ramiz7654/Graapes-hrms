# API Contracts

Both developers code against this file. Change it **first**, via PR, before changing an endpoint.

## Conventions

- Base path `/api`. JSON in/out. Cookies carry the session (`credentials: include`).
- Success: `200/201` with the resource or `{ "data": [...], "page": 1, "pageSize": 20, "total": 134 }` for lists.
- Errors (always this shape):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid", "details": [{ "field": "email", "message": "Invalid email" }] } }
  ```
- Status codes: 400 bad request · 401 not signed in · 403 not allowed · 404 not found (also used when a record is outside your scope) · 409 conflict (duplicate, stale version) · 422 validation · 429 too many requests · 503 dependency down.
- Lists: `?page=&pageSize=&q=&sort=&order=` plus module filters. Dates are ISO `YYYY-MM-DD`; timestamps ISO UTC.
- Clients never send role, approver, status, or employee id for "self" actions; the server derives them from the session.

## Implemented

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/health` | none | `200 {status:"ok", db:"up", time}` · `503 {status:"degraded", db:"down", time}` |

## Planned (Day shown)

| Day | Endpoints |
|---|---|
| 2 | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/accept-invite` · `GET /settings/public` |
| 3 | `GET/POST /employees` · `GET/PATCH /employees/:id` · `POST /employees/:id/deactivate` · `POST /employees/:id/invite` · `GET/POST/PATCH /departments` · `GET/POST/PATCH /designations` · `GET /audit` |
| 4 | `POST /attendance/check-in` · `POST /attendance/check-out` · `GET /attendance` · `GET /attendance/summary` · `POST /attendance/corrections` · `GET /attendance/corrections` · `PATCH /attendance/corrections/:id/decision` |
| 5 | `GET/POST/PATCH /leave-types` · `GET /leaves/balance` · `POST /leaves` · `GET /leaves` · `PATCH /leaves/:id/decision` · `POST /leaves/:id/cancel` · `POST /leave-balances/adjust` |
| 6 | `/holidays` · `/announcements` · `/documents` (+ `GET /documents/:id/download`) · `/hr-letters` · `/notifications` (+ `PATCH /notifications/:id/read`) · `GET /dashboard` · `GET /reports/:name` (+ `?format=csv\|xlsx`) · `GET/PATCH /settings` |
