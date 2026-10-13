import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobRunner, type JobRunResult } from '../../../common/scheduling/job-runner.service.js';
import { PaymentsService } from '../services/payments.service.js';

export const RECONCILE_PAYMENTS_JOB = 'reconcile-payments';

// Covers webhooks that never arrived or were rejected, and expires stale purchases.
@Injectable()
export class ReconcilePaymentsJob {
  private readonly logger = new Logger(ReconcilePaymentsJob.name);

  constructor(
    private readonly runner: JobRunner,
    private readonly payments: PaymentsService,
  ) {}

  @Cron('*/10 * * * *', { name: RECONCILE_PAYMENTS_JOB })
  async handleCron(): Promise<void> {
    try {
      await this.execute();
    } catch (error) {
      this.logger.error(`job ${RECONCILE_PAYMENTS_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  async execute(options: { force?: boolean } = {}): Promise<JobRunResult> {
    return this.runner.run(RECONCILE_PAYMENTS_JOB, () => this.payments.reconcilePending(new Date()), options);
  }
}
