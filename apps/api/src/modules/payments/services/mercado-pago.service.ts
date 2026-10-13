import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AppError } from '../../../common/errors/app-error.js';
import { appConfig } from '../../../config/app.config.js';
import { mercadoPagoConfig } from '../../../config/mercado-pago.config.js';
import type { ProviderPayment, ProviderPaymentStatus } from '../models/provider-payment.model.js';

const MP_API_URL = 'https://api.mercadopago.com';
const MP_TIMEOUT_MS = 10_000;

// Mercado Pago statuses outside the stored set are folded into their closest stored state.
const STATUS_MAP: Record<string, ProviderPaymentStatus> = {
  pending: 'pending',
  authorized: 'pending',
  in_process: 'in_process',
  in_mediation: 'in_process',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
};

interface MpPayment {
  id?: unknown;
  status?: unknown;
  status_detail?: unknown;
  external_reference?: unknown;
  transaction_amount?: unknown;
}

export interface CreatePreferenceInput {
  externalReference: string;
  title: string;
  unitPrice: number;
  payer: { email: string; name: string };
  expiresAt: Date | null;
}

const toProviderPayment = (payment: MpPayment): ProviderPayment => {
  if ((typeof payment.id !== 'number' && typeof payment.id !== 'string') || typeof payment.transaction_amount !== 'number') {
    throw new AppError('PAYMENT_PROVIDER_ERROR');
  }
  return {
    id: String(payment.id),
    status: STATUS_MAP[String(payment.status)] ?? 'pending',
    statusDetail: typeof payment.status_detail === 'string' ? payment.status_detail : null,
    externalReference: typeof payment.external_reference === 'string' ? payment.external_reference : '',
    transactionAmount: payment.transaction_amount,
  };
};

// The only place that talks to Mercado Pago (D17: REST with native fetch). Never logs the token or a response body.
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(
    @Inject(mercadoPagoConfig.KEY) private readonly config: ConfigType<typeof mercadoPagoConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async createPreference(input: CreatePreferenceInput): Promise<{ id: string; initPoint: string }> {
    const returnUrl = `${this.app.webUrl}/checkout/resultado?ref=${encodeURIComponent(input.externalReference)}`;
    const body = await this.request<{ id?: unknown; init_point?: unknown }>('POST', '/checkout/preferences', {
      items: [{ id: input.externalReference, title: input.title, quantity: 1, unit_price: input.unitPrice, currency_id: 'UYU' }],
      payer: { email: input.payer.email, name: input.payer.name },
      external_reference: input.externalReference,
      back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
      auto_return: 'approved',
      notification_url: `${this.app.apiPublicUrl}/api/payments/webhook/mercadopago`,
      statement_descriptor: 'MOVE',
      ...(input.expiresAt ? { expires: true, expiration_date_to: input.expiresAt.toISOString() } : {}),
    });
    if (typeof body.id !== 'string' || typeof body.init_point !== 'string') throw new AppError('PAYMENT_PROVIDER_ERROR');
    return { id: body.id, initPoint: body.init_point };
  }

  async getPayment(id: string): Promise<ProviderPayment> {
    return toProviderPayment(await this.request<MpPayment>('GET', `/v1/payments/${encodeURIComponent(id)}`));
  }

  async searchByExternalReference(ref: string): Promise<ProviderPayment[]> {
    const query = new URLSearchParams({ external_reference: ref, sort: 'date_created', criteria: 'desc' });
    const body = await this.request<{ results?: unknown }>('GET', `/v1/payments/search?${query.toString()}`);
    if (!Array.isArray(body.results)) throw new AppError('PAYMENT_PROVIDER_ERROR');
    return (body.results as MpPayment[]).map(toProviderPayment);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, payload?: object): Promise<T> {
    if (!this.config.accessToken) throw new AppError('PAYMENT_PROVIDER_ERROR');
    let response: Response;
    try {
      response = await fetch(`${MP_API_URL}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          accept: 'application/json',
          ...(payload ? { 'content-type': 'application/json' } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(MP_TIMEOUT_MS),
      });
    } catch {
      this.logger.warn(`mercado pago ${method} failed: network`);
      throw new AppError('PAYMENT_PROVIDER_ERROR');
    }
    if (!response.ok) {
      this.logger.warn(`mercado pago ${method} failed: ${response.status}`);
      throw new AppError('PAYMENT_PROVIDER_ERROR');
    }
    const body = (await response.json().catch(() => null)) as T | null;
    if (body === null || typeof body !== 'object') throw new AppError('PAYMENT_PROVIDER_ERROR');
    return body;
  }
}
