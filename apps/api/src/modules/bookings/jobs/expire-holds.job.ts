import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobRunner, type JobRunResult } from '../../../common/scheduling/job-runner.service.js';
import { BookingEmailsService } from '../services/booking-emails.service.js';
import { BookingsService } from '../services/bookings.service.js';

export const EXPIRE_HOLDS_JOB = 'expire-holds';

// R8: frees the spots of `pending_payment` holds whose time ran out and tells their clients (D93). Each expired hold
// is returned by exactly one run, and the email key is per booking, so nobody is told twice.
@Injectable()
export class ExpireHoldsJob {
  private readonly logger = new Logger(ExpireHoldsJob.name);

  constructor(
    private readonly runner: JobRunner,
    private readonly bookings: BookingsService,
    private readonly bookingEmails: BookingEmailsService,
  ) {}

  @Cron('* * * * *', { name: EXPIRE_HOLDS_JOB })
  async handleCron(): Promise<void> {
    try {
      await this.execute();
    } catch (error) {
      this.logger.error(`job ${EXPIRE_HOLDS_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  async execute(options: { force?: boolean } = {}): Promise<JobRunResult> {
    return this.runner.run(EXPIRE_HOLDS_JOB, () => this.expire(), options);
  }

  private async expire(): Promise<{ expired: number }> {
    const expiredIds = await this.bookings.expireHoldsWithIds(new Date());
    await this.bookingEmails.notConfirmed(expiredIds, 'hold_expired');
    return { expired: expiredIds.length };
  }
}
