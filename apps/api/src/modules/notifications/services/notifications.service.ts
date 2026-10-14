import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { brevoConfig, type BrevoConfig } from '../../../config/brevo.config.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { EmailLog } from '../entities/email-log.entity.js';
import { renderEmail, type EmailTemplate, type SendEmailInput, type SendResult, type TemplateParams } from '../templates/index.js';
import type { EmailFooter } from '../templates/layout.js';
import { BrevoError, BrevoService } from './brevo.service.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(EmailLog) private readonly emailLogs: Repository<EmailLog>,
    @Inject(brevoConfig.KEY) private readonly config: BrevoConfig,
    private readonly brevo: BrevoService,
    private readonly settings: SettingsService,
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

  // Notifies the fixed staff address (D102). Without an address nothing is registered: no `email_logs` row, only a log line.
  async sendToStaff<K extends EmailTemplate>(input: {
    template: K;
    idempotencyKey: string;
    params: TemplateParams[K];
  }): Promise<SendResult> {
    let address: string;
    try {
      ({ staffNotificationsEmail: address } = await this.settings.getContact());
    } catch {
      this.logger.error(`staff email failed ${input.template}`);
      return 'failed';
    }
    if (address === '') {
      this.logger.log(`staff email skipped ${input.template}: no address`);
      return 'skipped';
    }
    return this.send({ ...input, to: { email: address, name: 'MOVE' }, userId: null });
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
    const { subject, html, text } = renderEmail(input.template, input.params, await this.loadFooter());
    let messageId: string;
    try {
      ({ messageId } = await this.brevo.sendTransactional({ to: input.to, subject, html, text }));
    } catch (error) {
      if (!(error instanceof BrevoError)) throw error;
      this.logger.warn(`email failed ${input.template} user=${input.userId} code=${error.status}`);
      await this.markFailed(logId, String(error.status));
      return 'failed';
    }
    await this.markSent(logId, messageId);
    return 'sent';
  }

  private async loadFooter(): Promise<EmailFooter | undefined> {
    try {
      const { address, hours, whatsapp, instagram, email } = await this.settings.getContact();
      return { address, hours, whatsapp, instagram, email };
    } catch {
      this.logger.warn('email footer unavailable');
      return undefined;
    }
  }

  // Brevo already accepted the email: a failed update must never turn the row into `failed`.
  private async markSent(logId: string, messageId: string): Promise<void> {
    try {
      await this.emailLogs.update(logId, { status: 'sent', providerMessageId: messageId || null, sentAt: new Date() });
    } catch {
      this.logger.error(`email log ${logId} could not be marked as sent`);
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
