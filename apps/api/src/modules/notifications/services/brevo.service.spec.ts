import { BrevoService } from './brevo.service.js';

describe('BrevoService', () => {
  afterEach(() => vi.restoreAllMocks());
  const service = new BrevoService({ apiKey: 'k', senderEmail: 'hola@example.com', senderName: 'MOVE', dryRun: false });

  it('posts to the Brevo transactional endpoint', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<m1>' }), { status: 201 }));
    const result = await service.sendTransactional({ to: { email: 'a@b.c', name: 'A' }, subject: 's', html: '<p>h</p>', text: 't' });
    expect(result).toEqual({ messageId: '<m1>' });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init?.headers as Record<string, string>)['api-key']).toBe('k');
    expect(JSON.parse(String(init?.body))).toMatchObject({ sender: { email: 'hola@example.com', name: 'MOVE' }, to: [{ email: 'a@b.c', name: 'A' }] });
  });

  it('throws BrevoError with the HTTP status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(service.sendTransactional({ to: { email: 'a@b.c', name: 'A' }, subject: 's', html: 'h', text: 't' }))
      .rejects.toMatchObject({ status: 401 });
  });
});
