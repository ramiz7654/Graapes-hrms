import { Router } from 'express';

/**
 * GET /api/health
 * Reports API liveness and database reachability. `checkDb` is injected so tests
 * do not need a real database.
 */
export function healthRouter({ checkDb }) {
  const router = Router();
  router.get('/', async (_req, res) => {
    let db = 'up';
    try {
      await checkDb();
    } catch {
      db = 'down';
    }
    res.status(db === 'up' ? 200 : 503).json({
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      time: new Date().toISOString(),
    });
  });
  return router;
}
