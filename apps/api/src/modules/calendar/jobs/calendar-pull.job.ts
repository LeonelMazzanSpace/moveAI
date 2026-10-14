import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobRunner, type JobRunResult } from '../../../common/scheduling/job-runner.service.js';
import { CalendarSyncService } from '../services/calendar-sync.service.js';

export const CALENDAR_PULL_JOB = 'calendar-pull';

// D94: Google → MOVE. Does nothing until a calendar is connected and chosen.
@Injectable()
export class CalendarPullJob {
  private readonly logger = new Logger(CalendarPullJob.name);

  constructor(
    private readonly runner: JobRunner,
    private readonly sync: CalendarSyncService,
  ) {}

  @Cron('*/5 * * * *', { name: CALENDAR_PULL_JOB })
  async handleCron(): Promise<void> {
    try {
      await this.execute();
    } catch (error) {
      this.logger.error(`job ${CALENDAR_PULL_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  execute(options: { force?: boolean } = {}): Promise<JobRunResult> {
    return this.runner.run(CALENDAR_PULL_JOB, () => this.sync.pull(), options);
  }
}
