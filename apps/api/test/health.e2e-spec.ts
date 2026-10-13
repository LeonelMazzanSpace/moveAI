import { MODULE_METADATA } from '@nestjs/common/constants.js';
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

  it('answers 400 VALIDATION_FAILED to a JSON body over 1 MB', async () => {
    const body = JSON.stringify({ filler: 'x'.repeat(1024 * 1024 + 1) });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/health').set('Content-Type', 'application/json').send(body).expect(400);
    expect(res.body).toEqual({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Los datos enviados no son válidos.' });
  });
});

describe('PaymentsModule dev simulator registration', () => {
  const controllerNames = async (nodeEnv: string): Promise<string[]> => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', nodeEnv);
    const { PaymentsModule } = await import('../src/modules/payments/payments.module.js');
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PaymentsModule) as { name: string }[];
    return controllers.map((controller) => controller.name);
  };
  afterEach(() => { vi.unstubAllEnvs(); });

  it('registers DevSimulatorController outside production', async () => {
    expect(await controllerNames('development')).toContain('DevSimulatorController');
  });

  it('does not register DevSimulatorController in production', async () => {
    const names = await controllerNames('production');
    expect(names).not.toContain('DevSimulatorController');
    expect(names).toContain('WebhookController');
  });
});
