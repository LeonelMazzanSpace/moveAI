import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BUSINESS_TZ, businessToday } from '../../../common/time/business-time.js';
import { JobRunner, type JobRunResult } from '../../../common/scheduling/job-runner.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { ScheduleService } from '../services/schedule.service.js';

export const GENERATE_SLOTS_JOB = 'generate-slots';

@Injectable()
export class GenerateSlotsJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(GenerateSlotsJob.name);

  constructor(
    private readonly runner: JobRunner,
    private readonly schedule: ScheduleService,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.safeRun();
  }

  @Cron('0 3 * * *', { name: GENERATE_SLOTS_JOB, timeZone: BUSINESS_TZ })
  async handleCron(): Promise<void> {
    await this.safeRun();
  }

  // `days` defaults to the bookable window: today through `today + bookingWindowDays`, both included.
  async execute(options: { days?: number; force?: boolean } = {}): Promise<JobRunResult> {
    return this.runner.run(
      GENERATE_SLOTS_JOB,
      async () => {
        const days = options.days ?? (await this.settings.get('bookingWindowDays')) + 1;
        return { created: await this.schedule.generateSlots(businessToday(), days) };
      },
      { force: options.force },
    );
  }

  // A failed run must never crash startup or the scheduler: the next run picks up where this one stopped.
  private async safeRun(): Promise<void> {
    try {
      await this.execute();
    } catch (error) {
      this.logger.error(`job ${GENERATE_SLOTS_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
