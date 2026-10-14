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

  describe('subscriptions (preapproval)', () => {
    const preapprovalInput = {
      externalReference: 'ref-9', reason: 'Plan Mensual', payerEmail: 'a@test.move', frequency: 1,
      frequencyType: 'months' as const, amount: 3900, startDate: null,
    };

    it('creates a pending preapproval with the back url and the recurring amount', async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, { id: 'pre-1', init_point: 'https://mp.test/sub' }));

      await expect(service.createPreapproval(preapprovalInput)).resolves.toEqual({ id: 'pre-1', initPoint: 'https://mp.test/sub' });
      const { url, init } = lastCall();
      expect(url).toBe('https://api.mercadopago.com/preapproval');
      expect(init.method).toBe('POST');
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer TEST-token');
      expect(JSON.parse(init.body as string)).toEqual({
        reason: 'Plan Mensual',
        external_reference: 'ref-9',
        payer_email: 'a@test.move',
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 3900, currency_id: 'UYU' },
        back_url: 'https://move.test/checkout/resultado?debito=ref-9',
        status: 'pending',
      });
    });

    it('sends the start date as the start of that business day in Montevideo', async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, { id: 'pre-2', init_point: 'https://mp.test/sub2' }));
      await service.createPreapproval({ ...preapprovalInput, frequency: 30, frequencyType: 'days', startDate: '2026-11-16' });
      const body = JSON.parse(lastCall().init.body as string);
      expect(body.auto_recurring).toEqual({
        frequency: 30, frequency_type: 'days', transaction_amount: 3900, currency_id: 'UYU', start_date: '2026-11-16T03:00:00.000Z',
      });
    });

    it('rejects a preapproval answer without id or init point', async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, { id: 'pre-3' }));
      await expect(service.createPreapproval(preapprovalInput)).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
    });

    it('reads a preapproval and maps its next payment date to a business date', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, {
        id: 'pre-1', status: 'authorized', external_reference: 'ref-9', next_payment_date: '2026-11-16T02:30:00.000-03:00',
      }));
      await expect(service.getPreapproval('pre-1')).resolves.toEqual({
        id: 'pre-1', status: 'authorized', externalReference: 'ref-9', nextPaymentDate: '2026-11-16',
      });
      expect(lastCall().url).toBe('https://api.mercadopago.com/preapproval/pre-1');
      expect(lastCall().init.method).toBe('GET');
    });

    it.each(['pending', 'authorized', 'paused', 'cancelled'])('keeps the %s status', async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'pre-1', status, external_reference: 'ref-9', next_payment_date: null }));
      await expect(service.getPreapproval('pre-1')).resolves.toMatchObject({ status, nextPaymentDate: null });
    });

    it('rejects unknown preapproval statuses and malformed answers', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'pre-1', status: 'finished', external_reference: 'ref-9' }));
      await expect(service.getPreapproval('pre-1')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
      fetchMock.mockResolvedValue(jsonResponse(200, { status: 'authorized' }));
      await expect(service.getPreapproval('pre-1')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
    });

    it('cancels a preapproval with a PUT', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'pre-1', status: 'cancelled', external_reference: 'ref-9', next_payment_date: null }));
      await expect(service.cancelPreapproval('pre-1')).resolves.toMatchObject({ id: 'pre-1', status: 'cancelled' });
      const { url, init } = lastCall();
      expect(url).toBe('https://api.mercadopago.com/preapproval/pre-1');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({ status: 'cancelled' });
    });

    it('reads an authorized payment with its payment id', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 7001, preapproval_id: 'pre-1', status: 'processed', payment: { id: 555, status: 'approved' } }));
      await expect(service.getAuthorizedPayment('7001')).resolves.toEqual({
        id: '7001', preapprovalId: 'pre-1', paymentId: '555', status: 'processed',
      });
      expect(lastCall().url).toBe('https://api.mercadopago.com/authorized_payments/7001');
    });

    it('reads a scheduled authorized payment without a payment yet', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 7002, preapproval_id: 'pre-1', status: 'scheduled' }));
      await expect(service.getAuthorizedPayment('7002')).resolves.toEqual({
        id: '7002', preapprovalId: 'pre-1', paymentId: null, status: 'scheduled',
      });
    });

    it('rejects an authorized payment without its preapproval', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 7003, status: 'processed' }));
      await expect(service.getAuthorizedPayment('7003')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
    });

    it('searches the charges of a preapproval created in the last days', async () => {
      vi.useFakeTimers({ now: new Date('2026-10-14T12:00:00.000Z'), toFake: ['Date'] });
      try {
        fetchMock.mockResolvedValue(jsonResponse(200, {
          results: [
            { id: 1, preapproval_id: 'pre-1', status: 'processed', payment: { id: 11 }, date_created: '2026-10-10T10:00:00.000-03:00' },
            { id: 2, preapproval_id: 'pre-1', status: 'processed', payment: { id: 12 }, date_created: '2026-08-01T10:00:00.000-03:00' },
            { id: 3, preapproval_id: 'pre-1', status: 'scheduled', date_created: '2026-10-13T10:00:00.000-03:00' },
          ],
        }));
        await expect(service.searchAuthorizedPayments('pre-1', 40)).resolves.toEqual([
          { id: '1', preapprovalId: 'pre-1', paymentId: '11', status: 'processed' },
          { id: '3', preapprovalId: 'pre-1', paymentId: null, status: 'scheduled' },
        ]);
        expect(lastCall().url).toBe(
          'https://api.mercadopago.com/authorized_payments/search?preapproval_id=pre-1&sort=date_created&criteria=desc&limit=100&offset=0',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    // M-9: latest first, one page after another while every charge of the page is inside the window, at most 10 pages.
    describe('charge search pages', () => {
      const charge = (id: number, dateCreated: string) =>
        ({ id, preapproval_id: 'pre-1', status: 'processed', payment: { id: id + 1000 }, date_created: dateCreated });
      const recent = '2026-10-13T10:00:00.000-03:00';
      const fullPage = (first: number) =>
        jsonResponse(200, { results: Array.from({ length: 100 }, (_, i) => charge(first + i, recent)) });
      const offsets = () => fetchMock.mock.calls.map(([url]) => new URL(url as string).searchParams.get('offset'));

      beforeEach(() => { vi.useFakeTimers({ now: new Date('2026-10-14T12:00:00.000Z'), toFake: ['Date'] }); });
      afterEach(() => { vi.useRealTimers(); });

      it('reads the next page while the last one was full and recent', async () => {
        fetchMock.mockResolvedValueOnce(fullPage(1)).mockResolvedValueOnce(jsonResponse(200, { results: [charge(500, recent)] }));
        await expect(service.searchAuthorizedPayments('pre-1', 40)).resolves.toHaveLength(101);
        expect(offsets()).toEqual(['0', '100']);
      });

      it('stops at the first page that reaches charges older than the window', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, {
          results: [...Array.from({ length: 99 }, (_, i) => charge(i + 1, recent)), charge(100, '2026-08-01T10:00:00.000-03:00')],
        }));
        await expect(service.searchAuthorizedPayments('pre-1', 40)).resolves.toHaveLength(99);
        expect(offsets()).toEqual(['0']);
      });

      it('reads at most 10 pages', async () => {
        fetchMock.mockImplementation(async (url) => fullPage(Number(new URL(url as string).searchParams.get('offset'))));
        await expect(service.searchAuthorizedPayments('pre-1', 40)).resolves.toHaveLength(1000);
        expect(offsets()).toEqual(['0', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
      });
    });

    it('turns subscription failures into PAYMENT_PROVIDER_ERROR', async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { message: 'not found' }));
      await expect(service.getPreapproval('x')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
      await expect(service.cancelPreapproval('x')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
      await expect(service.getAuthorizedPayment('x')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
      fetchMock.mockResolvedValue(jsonResponse(200, { results: 'nope' }));
      await expect(service.searchAuthorizedPayments('x', 40)).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.createPreapproval(preapprovalInput)).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
    });
  });

  it('never calls Mercado Pago without an access token', async () => {
    const simulator = new MercadoPagoService({ accessToken: null, webhookSecret: null, simulatorEnabled: true }, app);
    await expect(simulator.getPayment('1')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
