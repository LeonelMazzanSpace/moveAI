import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
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

  // Only JSON is parsed: a form-encoded body never reaches a Nest route, so the same fields that work as JSON fail.
  it('answers 400 VALIDATION_FAILED to a form-encoded POST on a Nest route', async () => {
    const fields = { externalReference: randomUUID(), outcome: 'approved' };
    const json = await request(ctx.app.getHttpServer()).post('/api/payments/dev/simulate').send(fields).expect(404);
    expect(json.body.code).toBe('PURCHASE_NOT_FOUND');
    const form = await request(ctx.app.getHttpServer()).post('/api/payments/dev/simulate').type('form').send(fields).expect(400);
    expect(form.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
  });
});

// D4/D59: the simulator route exists only outside production, also when NODE_ENV comes from the .env file
// (the process starts without it), so the decision cannot be taken before ConfigModule has loaded the file.
describe('dev simulator registration (e2e)', () => {
  const PRODUCTION_ENV = [
    'NODE_ENV=production', 'MP_ACCESS_TOKEN=dummy-token', 'MP_WEBHOOK_SECRET=dummy-secret',
    'BREVO_API_KEY=dummy-key', 'BREVO_SENDER_EMAIL=hola@example.com',
  ];
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;
  let tempDir: string;
  let app: NestExpressApplication | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'move-env-'));
    delete process.env.NODE_ENV;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
  });

  afterEach(async () => {
    try {
      await app?.close();
    } finally {
      app = undefined;
      process.chdir(originalCwd);
      for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
      Object.assign(process.env, originalEnv);
      rmSync(tempDir, { recursive: true, force: true });
      vi.resetModules();
    }
  });

  // Boots the real AppModule with `lines` as the only .env file; the process has no NODE_ENV.
  const bootWithEnvFile = async (lines: string[]): Promise<request.Agent> => {
    writeFileSync(join(tempDir, '.env'), `${lines.join('\n')}\n`);
    process.chdir(tempDir);
    vi.resetModules();
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    return request.agent(app.getHttpServer());
  };

  it('does not mount POST /api/payments/dev/simulate when only the .env file says production', async () => {
    const agent = await bootWithEnvFile(PRODUCTION_ENV);
    expect(process.env.NODE_ENV).toBe('production');
    const res = await agent.post('/api/payments/dev/simulate').send({}).expect(404);
    expect(res.body).toEqual({ statusCode: 404, code: 'NOT_FOUND', message: 'No encontrado.' });
  });

  it('mounts POST /api/payments/dev/simulate when the .env file says development', async () => {
    const agent = await bootWithEnvFile(['NODE_ENV=development']);
    expect(process.env.NODE_ENV).toBe('development');
    const res = await agent.post('/api/payments/dev/simulate').send({}).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
  });
});
