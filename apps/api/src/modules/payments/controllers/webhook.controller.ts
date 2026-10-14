import { Controller, HttpCode, Inject, Logger, Post, Req } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../../../common/auth/public.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { mercadoPagoConfig } from '../../../config/mercado-pago.config.js';
import { verifyMercadoPagoSignature } from '../domain/webhook-signature.js';
import { MercadoPagoService } from '../services/mercado-pago.service.js';
import { PaymentsService } from '../services/payments.service.js';

const single = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

// Only the signed `data.id` is trusted: the payment state is read again from the Mercado Pago API.
@Public()
@Controller('payments/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly payments: PaymentsService,
    @Inject(mercadoPagoConfig.KEY) private readonly config: ConfigType<typeof mercadoPagoConfig>,
  ) {}

  @Post('mercadopago')
  @HttpCode(200)
  async mercadoPagoNotification(@Req() req: Request): Promise<{ received: true }> {
    const dataId = single(req.query['data.id']);
    const secret = this.config.webhookSecret;
    const valid =
      secret !== null &&
      verifyMercadoPagoSignature({
        signatureHeader: single(req.headers['x-signature']),
        requestId: single(req.headers['x-request-id']),
        dataId,
        secret,
      });
    if (!valid) throw new AppError('INVALID_SIGNATURE');
    if (!dataId) return { received: true };

    // D96: subscriptions notify their state and each charge; any other type is acknowledged without effects.
    const type = single(req.query.type);
    if (type === 'payment') {
      this.logger.log(`webhook payment=${dataId}`);
      await this.payments.applyProviderPayment(await this.mercadoPago.getPayment(dataId));
    } else if (type === 'subscription_preapproval') {
      this.logger.log(`webhook preapproval=${dataId}`);
      await this.payments.refreshAutoDebit(dataId);
    } else if (type === 'subscription_authorized_payment') {
      this.logger.log(`webhook authorized_payment=${dataId}`);
      await this.payments.applyAuthorizedPayment(dataId);
    }
    return { received: true };
  }
}
