import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobRunner, type JobRunResult } from '../../../common/scheduling/job-runner.service.js';
import { CalendarSyncService } from '../services/calendar-sync.service.js';

export const CALENDAR_PUSH_JOB = 'calendar-push';

// D94: MOVE → Google. Does nothing until a calendar is connected and chosen.
@Injectable()
export class CalendarPushJob {
  private readonly logger = new Logger(CalendarPushJob.name);

  constructor(
    private readonly runner: JobRunner,
    private readonly sync: CalendarSyncService,
  ) {}

  @Cron('* * * * *', { name: CALENDAR_PUSH_JOB })
  async handleCron(): Promise<void> {
    try {
      await this.execute();
    } catch (error) {
      this.logger.error(`job ${CALENDAR_PUSH_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  execute(options: { force?: boolean } = {}): Promise<JobRunResult> {
    return this.runner.run(CALENDAR_PUSH_JOB, () => this.sync.push(), options);
  }
}
