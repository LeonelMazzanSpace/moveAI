import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { resetDb } from './utils/db.js';

// D58. Supertest connects from 127.0.0.1, which plays the Nginx in front of the API; the X-Forwarded-For header is
// what Nginx forwards behind the ALB: "<client>, <ALB address>". Unknown plan and slot ids answer 404 after the
// throttler has counted the request, so no fixtures are needed.
describe('client IP behind the proxy (e2e)', () => {
  const originalHops = process.env.TRUST_PROXY_HOPS;
  let ctx: TestApp;

  async function start(hops: string): Promise<void> {
    process.env.TRUST_PROXY_HOPS = hops;
    ctx = await createTestApp();
    await resetDb(ctx.dataSource);
  }

  afterEach(async () => {
    await ctx.app.close();
    if (originalHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalHops;
  });

  const clientA = '203.0.113.10';
  const clientB = '203.0.113.20';
  const behindProxies = (client: string) => `${client}, 10.0.0.5`;
  const checkout = (forwardedFor?: string) => {
    const req = request(ctx.app.getHttpServer()).post('/api/checkout/booking');
    if (forwardedFor) req.set('X-Forwarded-For', forwardedFor);
    return req.send({
      planId: randomUUID(),
      timeSlotId: randomUUID(),
      guest: { name: 'Invitada Test', email: `guest-${randomUUID()}@test.move`, phone: '099123456' },
    });
  };
  const exhaust = async (forwardedFor?: string) => {
    for (let i = 0; i < 10; i += 1) await checkout(forwardedFor).expect(404);
  };

  it('keeps separate counters per forwarded client with TRUST_PROXY_HOPS=2', async () => {
    await start('2');
    await exhaust(behindProxies(clientA));

    const blocked = await checkout(behindProxies(clientA)).expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    await checkout(behindProxies(clientB)).expect(404);
  });

  it('ignores entries the client prepends to X-Forwarded-For with TRUST_PROXY_HOPS=2', async () => {
    await start('2');
    await exhaust(behindProxies(clientA));

    await checkout(`198.51.100.7, ${behindProxies(clientA)}`).expect(429);
  });

  it('ignores X-Forwarded-For with TRUST_PROXY_HOPS=0', async () => {
    await start('0');
    await exhaust(behindProxies(clientA));

    const blocked = await checkout(behindProxies(clientB)).expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    await checkout().expect(429);
  });
});
