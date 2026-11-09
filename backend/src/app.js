import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { leavesRouter } from './modules/leaves/leaves.routes.js';
import { employeesRouter } from './modules/employees/employees.routes.js';
import { organizationRouter } from './modules/organization/organization.routes.js';
import { holidaysRouter } from './modules/holidays/holidays.routes.js';
import { announcementsRouter } from './modules/announcements/announcements.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';

/**
 * Builds the Express app. Kept separate from server.js so tests can import it
 * without opening a network port.
 */
export function createApp({ checkDb }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  // Document uploads arrive as base64 JSON (max 5 MB file), so this route gets a larger body limit than the rest of the API.
  app.use('/api/documents', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Request logging: method, path, status, time. Bodies/headers are NOT logged.
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  // Core API Routes
  app.use('/api/health', healthRouter({ checkDb }));
  app.use('/api/auth', authRouter());
  app.use('/api/dashboard', dashboardRouter());
  app.use('/api/attendance', attendanceRouter());
  app.use('/api/leaves', leavesRouter());
  app.use('/api/employees', employeesRouter());
  app.use('/api/organization', organizationRouter());
  app.use('/api/holidays', holidaysRouter());
  app.use('/api/announcements', announcementsRouter());
  app.use('/api/documents', documentsRouter());
  app.use('/api/audit', auditRouter());
  app.use('/api/reports', reportsRouter());
  app.use('/api/settings', settingsRouter());
  app.use('/api/notifications', notificationsRouter());

  // Serve the built React app (frontend/dist) so web + API run as one service in production.
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  app.use(express.static(webDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(webDist, 'index.html')));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
