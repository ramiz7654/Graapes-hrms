# Architecture

Modular monolith: one React app, one Express API, one PostgreSQL database. No microservices.

```
Browser (React + Vite)  --/api-->  Express API  -->  Prisma  -->  PostgreSQL
                                        |
                                        +--> private file storage (local folder now, S3-compatible later)
```

## Decisions (and why)

| Decision | Choice | Reason |
|---|---|---|
| Language | **JavaScript** (not TypeScript) | 8 days, two developers new to full-stack. Zod validates inputs at runtime. Can migrate later. |
| Package manager | **npm workspaces** | Ships with Node; fewer Windows surprises than pnpm. |
| Auth | HttpOnly **session cookie** (signed token carrying user id + `tokenVersion`) | Not readable by JavaScript (XSS-safe); logout/deactivate invalidates instantly via `tokenVersion`. Needs CSRF protection (Day 2: SameSite=Lax + custom header check). |
| Password hashing | **bcryptjs** (cost 12) | Pure JS, installs on Windows without a compiler. Argon2id needs native build tools. |
| RBAC | Permission map in code (`role -> permissions`) + scope checks in queries | Simple, testable, documented in `role-permission-matrix.md`. |
| Validation | Zod on the server; same rules mirrored in forms | Server is the source of truth. |
| Money / payroll | Not built | OQ-07 |
| Time | Store UTC; business date computed in `COMPANY_TIMEZONE` | BR-009 |

## Folder map

```
apps/api/src
  config/       env loading + validation (fails fast on bad config)
  middleware/   errorHandler (auth, rbac, rate-limit added Day 2)
  modules/<x>/  routes + service + validators per feature (health done)
  lib/          prisma client
  utils/        HttpError helpers
apps/web/src
  app/          providers (theme, layout), routes, navigation registry
  layouts/      AppShell (desktop sidebar / mobile bottom nav)
  features/<x>/ screens per module
  services/     api.js (single fetch wrapper)
  utils/        device detection
prisma/         schema.prisma, migrations/, seed.js
```

## Rules for both developers

1. Each module owns its folder. Shared files (`app.js` route list, `navigation.js`, `schema.prisma`) are changed **only via small PRs**, announced in chat first.
2. **Only Dev 1 edits `schema.prisma`.** Dev 2 requests changes through an issue; Dev 1 merges within the hour.
3. Authorization lives in the **service layer**, never only in the UI.
4. Every consequential action writes an `AuditLog` row.
5. No mocked data in screens. Empty database -> empty state.

## Mobile layout detection

`apps/web/src/utils/device.js`. Order: `navigator.userAgentData.mobile` -> mobile user-agent -> iPadOS-desktop-mode check -> small physical `screen` size + coarse pointer. The user's `Auto/Mobile/Desktop` choice (stored in `localStorage`) overrides everything. Browsers can spoof or hide these hints, so this is best effort and the page stays usable either way. **Must be tested on a real Android Chrome and iPhone Safari with "Desktop site" ON.**

## Security baseline (Day 1)

Helmet headers, CORS limited to `WEB_ORIGIN`, JSON body limit, no stack traces to clients, request logging without bodies, `.env` git-ignored, no default passwords. Rate limiting, CSRF, RBAC, upload validation arrive with the modules that need them.
