import { Inject, Injectable } from '@nestjs/common';
import { brevoConfig, type BrevoConfig } from '../../../config/brevo.config.js';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 10_000;

export interface TransactionalEmail {
  to: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
}

export class BrevoError extends Error {
  constructor(readonly status: number | 'network') {
    super(`Brevo request failed (${status})`);
    this.name = 'BrevoError';
  }
}

@Injectable()
export class BrevoService {
  constructor(@Inject(brevoConfig.KEY) private readonly config: BrevoConfig) {}

  async sendTransactional({ to, subject, html, text }: TransactionalEmail): Promise<{ messageId: string }> {
    const response = await this.post({
      sender: { email: this.config.senderEmail, name: this.config.senderName },
      to: [to],
      subject,
      htmlContent: html,
      textContent: text,
    });
    if (!response.ok) throw new BrevoError(response.status);

    const body = (await response.json().catch(() => null)) as { messageId?: unknown } | null;
    return { messageId: typeof body?.messageId === 'string' ? body.messageId : '' };
  }

  private async post(payload: object): Promise<Response> {
    try {
      return await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey ?? '',
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      });
    } catch {
      throw new BrevoError('network');
    }
  }
}
