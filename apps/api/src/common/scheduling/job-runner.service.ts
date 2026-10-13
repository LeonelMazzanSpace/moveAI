import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { schedulerConfig } from '../../config/scheduler.config.js';

export interface JobRunResult { ran: boolean; result: Record<string, number> }

const SKIPPED: JobRunResult = { ran: false, result: {} };

@Injectable()
export class JobRunner {
  private readonly logger = new Logger(JobRunner.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(schedulerConfig.KEY) private readonly config: ConfigType<typeof schedulerConfig>,
  ) {}

  // A Postgres advisory lock keeps a job from running twice at once, even across instances.
  async run(
    job: string,
    fn: () => Promise<Record<string, number>>,
    options: { force?: boolean } = {},
  ): Promise<JobRunResult> {
    if (!this.config.enabled && !options.force) return { ...SKIPPED };

    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      const [{ locked }] = (await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [
        job,
      ])) as { locked: boolean }[];
      if (!locked) {
        this.logger.log(`job ${job} skipped: already running`);
        return { ...SKIPPED };
      }
      try {
        const result = await fn();
        this.logger.log(`job ${job} ${JSON.stringify(result)}`);
        return { ran: true, result };
      } finally {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [job]);
      }
    } finally {
      await runner.release();
    }
  }
}
