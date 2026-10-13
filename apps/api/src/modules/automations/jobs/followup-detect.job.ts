import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BUSINESS_TZ } from '../../../common/time/business-time.js';
import { AutomationsService } from '../services/automations.service.js';

export const FOLLOWUP_DETECT_JOB = 'followup-detect';

@Injectable()
export class FollowupDetectJob {
  private readonly logger = new Logger(FollowupDetectJob.name);

  constructor(private readonly automations: AutomationsService) {}

  @Cron('0 7 * * *', { name: FOLLOWUP_DETECT_JOB, timeZone: BUSINESS_TZ })
  async handleCron(): Promise<void> {
    try {
      await this.automations.run(FOLLOWUP_DETECT_JOB, { force: false });
    } catch (error) {
      this.logger.error(`job ${FOLLOWUP_DETECT_JOB} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
