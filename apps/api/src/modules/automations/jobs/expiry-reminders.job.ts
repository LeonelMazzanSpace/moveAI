import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BUSINESS_TZ } from '../../../common/time/business-time.js';
import { AutomationsService } from '../services/automations.service.js';

export const EXPIRY_REMINDERS_JOB = 'expiry-reminders';

@Injectable()
export class ExpiryRemindersJob {
  private readonly logger = new Logger(ExpiryRemindersJob.name);

  constructor(private readonly automations: AutomationsService) {}

  @Cron('0 9 * * *', { name: EXPIRY_REMINDERS_JOB, timeZone: BUSINESS_TZ })
  async handleCron(): Promise<void> {
    try {
      await this.automations.run(EXPIRY_REMINDERS_JOB, { force: false });
    } catch (error) {
      this.logger.error(`job ${EXPIRY_REMINDERS_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
