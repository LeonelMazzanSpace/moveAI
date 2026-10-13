import { JobRunner } from '../src/common/scheduling/job-runner.service.js';
import { createTestApp, type TestApp } from './utils/app.js';

describe('JobRunner (e2e)', () => {
  let ctx: TestApp;
  let runner: JobRunner;
  beforeAll(async () => { ctx = await createTestApp(); runner = ctx.app.get(JobRunner); });
  afterAll(async () => { await ctx.app.close(); });

  // Probes the advisory lock of `job` from a separate connection. Taking it means nobody holds it, so it is given back.
  async function isLockFree(job: string): Promise<boolean> {
    const probe = ctx.dataSource.createQueryRunner();
    await probe.connect();
    try {
      const [{ locked }] = (await probe.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [job])) as { locked: boolean }[];
      if (locked) await probe.query('SELECT pg_advisory_unlock(hashtext($1))', [job]);
      return locked;
    } finally {
      await probe.release();
    }
  }

  async function waitForLockHeld(job: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (!(await isLockFree(job))) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`job ${job} never took its lock`);
  }

  it('skips when the scheduler is disabled unless forced', async () => {
    expect(await runner.run('test-disabled', async () => ({ n: 1 }))).toEqual({ ran: false, result: {} });
    expect(await runner.run('test-disabled', async () => ({ n: 1 }), { force: true })).toEqual({ ran: true, result: { n: 1 } });
    expect(await isLockFree('test-disabled')).toBe(true);
  });

  it('never runs the same job twice at the same time', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = runner.run('test-lock', async () => { await gate; return { n: 1 }; }, { force: true });
    try {
      await waitForLockHeld('test-lock');
      expect(await isLockFree('test-lock')).toBe(false);
      const second = await runner.run('test-lock', async () => ({ n: 2 }), { force: true });
      expect(second.ran).toBe(false);
    } finally {
      release();
    }
    expect((await first).ran).toBe(true);
    expect(await isLockFree('test-lock')).toBe(true);
    expect(await runner.run('test-lock', async () => ({ n: 3 }), { force: true })).toEqual({ ran: true, result: { n: 3 } });
  });

  it('releases the lock when the job fails', async () => {
    const failing = runner.run('test-fail', async () => { throw new Error('boom'); }, { force: true });
    await expect(failing).rejects.toThrow('boom');
    expect(await isLockFree('test-fail')).toBe(true);
    expect(await runner.run('test-fail', async () => ({ n: 1 }), { force: true })).toEqual({ ran: true, result: { n: 1 } });
  });
});
