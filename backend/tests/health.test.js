import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns 200 and db=up when the database responds', async () => {
    const app = createApp({ checkDb: async () => {} });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('returns 503 and db=down when the database is unreachable', async () => {
    const app = createApp({
      checkDb: async () => {
        throw new Error('connection refused');
      },
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'down' });
  });

  it('returns the standard error shape for unknown routes', async () => {
    const app = createApp({ checkDb: async () => {} });
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('sets security headers and hides x-powered-by', async () => {
    const app = createApp({ checkDb: async () => {} });
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
