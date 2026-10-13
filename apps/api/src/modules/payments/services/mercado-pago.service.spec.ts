import { AppError } from '../../../common/errors/app-error.js';
import { MercadoPagoService } from './mercado-pago.service.js';

const app = { port: 3001, webUrl: 'https://move.test', apiPublicUrl: 'https://api.move.test', nodeEnv: 'test', trustProxyHops: 0 };
const mp = { accessToken: 'TEST-token', webhookSecret: 'secret', simulatorEnabled: false };

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('MercadoPagoService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const service = new MercadoPagoService(mp, app);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const lastCall = (): { url: string; init: RequestInit } => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url: url as string, init: init ?? {} };
  };

  it('creates a preference with the return and notification urls', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'pref-1', init_point: 'https://mp.test/init' }));
    const expiresAt = new Date('2026-10-14T12:00:00.000Z');

    const result = await service.createPreference({
      externalReference: 'ref-1', title: 'Plan Mensual', unitPrice: 3900, payer: { email: 'a@test.move', name: 'Ana' }, expiresAt,
    });

    expect(result).toEqual({ id: 'pref-1', initPoint: 'https://mp.test/init' });
    const { url, init } = lastCall();
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer TEST-token');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      external_reference: 'ref-1',
      items: [{ id: 'ref-1', title: 'Plan Mensual', quantity: 1, unit_price: 3900, currency_id: 'UYU' }],
      notification_url: 'https://api.move.test/api/payments/webhook/mercadopago',
      auto_return: 'approved',
      statement_descriptor: 'MOVE',
      expires: true,
      expiration_date_to: expiresAt.toISOString(),
    });
    expect(body.back_urls.success.endsWith('/checkout/resultado?ref=ref-1')).toBe(true);
    expect(body.back_urls.pending.endsWith('/checkout/resultado?ref=ref-1')).toBe(true);
    expect(body.back_urls.failure.endsWith('/checkout/resultado?ref=ref-1')).toBe(true);
  });

  it('omits the expiration without a hold', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'pref-2', init_point: 'https://mp.test/init2' }));
    await service.createPreference({
      externalReference: 'ref-2', title: 'Plan', unitPrice: 1, payer: { email: 'a@test.move', name: 'Ana' }, expiresAt: null,
    });
    const body = JSON.parse(lastCall().init.body as string);
    expect(body.expires).toBeUndefined();
    expect(body.expiration_date_to).toBeUndefined();
  });

  it('maps a payment from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      id: 123, status: 'approved', status_detail: 'accredited', external_reference: 'ref-1', transaction_amount: 3900,
    }));

    await expect(service.getPayment('123')).resolves.toEqual({
      id: '123', status: 'approved', statusDetail: 'accredited', externalReference: 'ref-1', transactionAmount: 3900,
    });
    const { url, init } = lastCall();
    expect(url).toBe('https://api.mercadopago.com/v1/payments/123');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer TEST-token');
  });

  it('maps statuses outside the stored set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      id: 9, status: 'charged_back', status_detail: null, external_reference: null, transaction_amount: 10,
    }));
    await expect(service.getPayment('9')).resolves.toEqual({
      id: '9', status: 'refunded', statusDetail: null, externalReference: '', transactionAmount: 10,
    });
  });

  it('searches payments by external reference, latest first', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      results: [{ id: 2, status: 'rejected', status_detail: 'cc_rejected_other_reason', external_reference: 'ref-1', transaction_amount: 5 }],
    }));
    await expect(service.searchByExternalReference('ref-1')).resolves.toEqual([
      { id: '2', status: 'rejected', statusDetail: 'cc_rejected_other_reason', externalReference: 'ref-1', transactionAmount: 5 },
    ]);
    expect(lastCall().url).toBe(
      'https://api.mercadopago.com/v1/payments/search?external_reference=ref-1&sort=date_created&criteria=desc',
    );
  });

  it('turns provider failures into PAYMENT_PROVIDER_ERROR', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'internal' }));
    await expect(service.getPayment('1')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });

    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      service.createPreference({ externalReference: 'r', title: 't', unitPrice: 1, payer: { email: 'a@test.move', name: 'A' }, expiresAt: null }),
    ).rejects.toBeInstanceOf(AppError);

    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'pref-3' }));
    await expect(
      service.createPreference({ externalReference: 'r', title: 't', unitPrice: 1, payer: { email: 'a@test.move', name: 'A' }, expiresAt: null }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
  });

  it('never calls Mercado Pago without an access token', async () => {
    const simulator = new MercadoPagoService({ accessToken: null, webhookSecret: null, simulatorEnabled: true }, app);
    await expect(simulator.getPayment('1')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
