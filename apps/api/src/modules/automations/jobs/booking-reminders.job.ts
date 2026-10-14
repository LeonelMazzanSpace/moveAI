import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BUSINESS_TZ } from '../../../common/time/business-time.js';
import { AutomationsService } from '../services/automations.service.js';

export const BOOKING_REMINDERS_JOB = 'booking-reminders';

@Injectable()
export class BookingRemindersJob {
  private readonly logger = new Logger(BookingRemindersJob.name);

  constructor(private readonly automations: AutomationsService) {}

  @Cron('0 18 * * *', { name: BOOKING_REMINDERS_JOB, timeZone: BUSINESS_TZ })
  async handleCron(): Promise<void> {
    try {
      await this.automations.run(BOOKING_REMINDERS_JOB, { force: false });
    } catch (error) {
      this.logger.error(`job ${BOOKING_REMINDERS_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
