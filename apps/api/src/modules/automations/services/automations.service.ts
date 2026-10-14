import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { JobRunner, type JobRunResult } from '../../../common/scheduling/job-runner.service.js';
import { businessMonth, businessToday, isFirstMondayOfMonth } from '../../../common/time/business-time.js';
import { ExpireHoldsJob } from '../../bookings/jobs/expire-holds.job.js';
import { AlertsService } from '../../followup/services/alerts.service.js';
import { CheckinsService } from '../../followup/services/checkins.service.js';
import { ReconcilePaymentsJob } from '../../payments/jobs/reconcile-payments.job.js';
import { GenerateSlotsJob } from '../../schedule/jobs/generate-slots.job.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { isJobName, type JobName, type JobRunResultDto } from '../models/job.model.js';
import { BookingRemindersService } from './booking-reminders.service.js';
import { ExpiryRemindersService } from './expiry-reminders.service.js';

type JobStarter = (force: boolean) => Promise<JobRunResult>;

// Runs every scheduled job under the same name and lock the module crons use, so a manual run never overlaps a cron.
@Injectable()
export class AutomationsService {
  private readonly starters: Record<JobName, JobStarter> = {
    'followup-detect': this.locked('followup-detect', () => this.alerts.detectAlerts(businessToday())),
    'checkins-monthly': this.locked('checkins-monthly', (force) => this.sendMonthlyCheckins(force)),
    'expiry-reminders': this.locked('expiry-reminders', () => this.expiryReminders.run()),
    'generate-slots': (force) => this.generateSlots.execute({ force }),
    'expire-holds': (force) => this.expireHolds.execute({ force }),
    'reconcile-payments': (force) => this.reconcilePayments.execute({ force }),
    'booking-reminders': this.locked('booking-reminders', () => this.bookingReminders.run()),
  };

  constructor(
    private readonly runner: JobRunner,
    private readonly alerts: AlertsService,
    private readonly checkins: CheckinsService,
    private readonly expiryReminders: ExpiryRemindersService,
    private readonly generateSlots: GenerateSlotsJob,
    private readonly expireHolds: ExpireHoldsJob,
    private readonly reconcilePayments: ReconcilePaymentsJob,
    private readonly settings: SettingsService,
    private readonly bookingReminders: BookingRemindersService,
  ) {}

  async run(job: string, options: { force: boolean }): Promise<JobRunResultDto> {
    if (!isJobName(job)) throw new AppError('JOB_UNKNOWN');
    const { ran, result } = await this.starters[job](options.force);
    return { job, ran, result };
  }

  private locked(name: JobName, body: (force: boolean) => Promise<Record<string, number>>): JobStarter {
    return (force) => this.runner.run(name, () => body(force), { force });
  }

  // D9: the cron fires daily and only acts on the first Monday of the month, when the option is on.
  private async sendMonthlyCheckins(force: boolean): Promise<Record<string, number>> {
    const today = businessToday();
    if (!force && !(isFirstMondayOfMonth(today) && (await this.settings.get('checkinMonthlyEnabled')))) return { skipped: 1 };
    const { sent } = await this.checkins.send(businessMonth(today));
    return { sent };
  }
}
