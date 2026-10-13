import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { JobRunner } from '../../../common/scheduling/job-runner.service.js';
import { businessMonth, businessToday, isFirstMondayOfMonth } from '../../../common/time/business-time.js';
import { BookingsService } from '../../bookings/services/bookings.service.js';
import { AlertsService } from '../../followup/services/alerts.service.js';
import { CheckinsService } from '../../followup/services/checkins.service.js';
import { PaymentsService } from '../../payments/services/payments.service.js';
import { ScheduleService } from '../../schedule/services/schedule.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { isJobName, type JobName, type JobRunResultDto } from '../models/job.model.js';
import { ExpiryRemindersService } from './expiry-reminders.service.js';

type JobBody = (force: boolean) => Promise<Record<string, number>>;

// Runs every scheduled job under the same name and lock the module crons use, so a manual run never overlaps a cron.
@Injectable()
export class AutomationsService {
  private readonly bodies: Record<JobName, JobBody> = {
    'followup-detect': () => this.alerts.detectAlerts(businessToday()),
    'checkins-monthly': (force) => this.sendMonthlyCheckins(force),
    'expiry-reminders': () => this.expiryReminders.run(),
    'generate-slots': async () => ({
      created: await this.schedule.generateSlots(businessToday(), (await this.settings.get('bookingWindowDays')) + 1),
    }),
    'expire-holds': async () => ({ expired: await this.bookings.expireHolds(new Date()) }),
    'reconcile-payments': () => this.payments.reconcilePending(new Date()),
  };

  constructor(
    private readonly runner: JobRunner,
    private readonly alerts: AlertsService,
    private readonly checkins: CheckinsService,
    private readonly expiryReminders: ExpiryRemindersService,
    private readonly schedule: ScheduleService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
  ) {}

  async run(job: string, options: { force: boolean }): Promise<JobRunResultDto> {
    if (!isJobName(job)) throw new AppError('JOB_UNKNOWN');
    const { ran, result } = await this.runner.run(job, () => this.bodies[job](options.force), { force: options.force });
    return { job, ran, result };
  }

  // D9: the cron fires daily and only acts on the first Monday of the month, when the option is on.
  private async sendMonthlyCheckins(force: boolean): Promise<Record<string, number>> {
    const today = businessToday();
    if (!force && !(isFirstMondayOfMonth(today) && (await this.settings.get('checkinMonthlyEnabled')))) return { skipped: 1 };
    const { sent } = await this.checkins.send(businessMonth(today));
    return { sent };
  }
}
