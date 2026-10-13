import { JobRunner } from '../src/common/scheduling/job-runner.service.js';
import { createTestApp, type TestApp } from './utils/app.js';

describe('JobRunner (e2e)', () => {
  let ctx: TestApp;
  let runner: JobRunner;
  beforeAll(async () => { ctx = await createTestApp(); runner = ctx.app.get(JobRunner); });
  afterAll(async () => { await ctx.app.close(); });

  it('skips when the scheduler is disabled unless forced', async () => {
    expect(await runner.run('test-disabled', async () => ({ n: 1 }))).toEqual({ ran: false, result: {} });
    expect(await runner.run('test-disabled', async () => ({ n: 1 }), { force: true })).toEqual({ ran: true, result: { n: 1 } });
  });

  it('never runs the same job twice at the same time', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = runner.run('test-lock', async () => { await gate; return { n: 1 }; }, { force: true });
    await new Promise((r) => setTimeout(r, 100));
    const second = await runner.run('test-lock', async () => ({ n: 2 }), { force: true });
    release();
    expect(second.ran).toBe(false);
    expect((await first).ran).toBe(true);
  });
});
