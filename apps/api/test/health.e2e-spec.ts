import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';

describe('health (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });

  it('GET /api/health is public', async () => {
    await request(ctx.app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });

  it('unknown routes use the error envelope', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/nope').expect(404);
    expect(res.body).toEqual({ statusCode: 404, code: 'NOT_FOUND', message: 'No encontrado.' });
  });
});
