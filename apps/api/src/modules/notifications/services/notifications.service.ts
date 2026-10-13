import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { brevoConfig, type BrevoConfig } from '../../../config/brevo.config.js';
import { EmailLog } from '../entities/email-log.entity.js';
import { renderEmail, type EmailTemplate, type SendEmailInput, type SendResult } from '../templates/index.js';
import { BrevoError, BrevoService } from './brevo.service.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(EmailLog) private readonly emailLogs: Repository<EmailLog>,
    @Inject(brevoConfig.KEY) private readonly config: BrevoConfig,
    private readonly brevo: BrevoService,
  ) {}

  async send<K extends EmailTemplate>(input: SendEmailInput<K>): Promise<SendResult> {
    let logId: string | null = null;
    try {
      logId = await this.registerPending(input);
      if (!logId) return 'duplicate';
      if (this.config.dryRun) return await this.skip(logId, input);
      return await this.deliver(logId, input);
    } catch {
      this.logger.error(`email failed ${input.template} user=${input.userId}`);
      if (logId) await this.markFailed(logId, 'internal');
      return 'failed';
    }
  }

  private async registerPending(input: SendEmailInput): Promise<string | null> {
    const result = await this.emailLogs
      .createQueryBuilder()
      .insert()
      .values({
        idempotencyKey: input.idempotencyKey,
        template: input.template,
        userId: input.userId,
        status: 'pending',
      })
      .orIgnore()
      .returning('id')
      .execute();
    const [row] = result.raw as { id: string }[];
    return row?.id ?? null;
  }

  private async skip(logId: string, input: SendEmailInput): Promise<SendResult> {
    await this.emailLogs.update(logId, { status: 'skipped' });
    this.logger.log(`email skipped ${input.template} user=${input.userId}`);
    return 'skipped';
  }

  private async deliver<K extends EmailTemplate>(logId: string, input: SendEmailInput<K>): Promise<SendResult> {
    const { subject, html, text } = renderEmail(input.template, input.params);
    try {
      const { messageId } = await this.brevo.sendTransactional({ to: input.to, subject, html, text });
      await this.emailLogs.update(logId, { status: 'sent', providerMessageId: messageId || null, sentAt: new Date() });
      return 'sent';
    } catch (error) {
      if (!(error instanceof BrevoError)) throw error;
      this.logger.warn(`email failed ${input.template} user=${input.userId} code=${error.status}`);
      await this.markFailed(logId, String(error.status));
      return 'failed';
    }
  }

  private async markFailed(logId: string, errorCode: string): Promise<void> {
    try {
      await this.emailLogs.update(logId, { status: 'failed', errorCode });
    } catch {
      this.logger.error(`email log ${logId} could not be marked as failed`);
    }
  }
}
