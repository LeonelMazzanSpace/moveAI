import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BUSINESS_TZ } from '../../../common/time/business-time.js';
import { AutomationsService } from '../services/automations.service.js';

export const CHECKINS_MONTHLY_JOB = 'checkins-monthly';

@Injectable()
export class CheckinsMonthlyJob {
  private readonly logger = new Logger(CheckinsMonthlyJob.name);

  constructor(private readonly automations: AutomationsService) {}

  @Cron('0 10 * * *', { name: CHECKINS_MONTHLY_JOB, timeZone: BUSINESS_TZ })
  async handleCron(): Promise<void> {
    try {
      await this.automations.run(CHECKINS_MONTHLY_JOB, { force: false });
    } catch (error) {
      this.logger.error(`job ${CHECKINS_MONTHLY_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
