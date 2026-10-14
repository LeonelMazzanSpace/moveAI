import type { CalendarConfig } from '../../../config/calendar.config.js';
import { GoogleCalendarError, GoogleCalendarService } from './google-calendar.service.js';

const config: CalendarConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenKey: Buffer.alloc(32),
  redirectUri: 'https://api.move.test/api/calendar/oauth/callback',
  configured: true,
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('GoogleCalendarService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const service = new GoogleCalendarService(config);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const call = (index = -1): { url: string; init: RequestInit } => {
    const [url, init] = fetchMock.mock.calls.at(index)!;
    return { url: url as string, init: init ?? {} };
  };
  const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name);
  const form = (init: RequestInit) => Object.fromEntries(new URLSearchParams(init.body as string));

  it('builds the consent url with offline access, the scopes and the state', () => {
    const url = new URL(service.buildAuthUrl('signed-state'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-id',
      redirect_uri: 'https://api.move.test/api/calendar/oauth/callback',
      response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: 'signed-state',
    });
  });

  it('exchanges the code for tokens and the scopes Google granted', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      access_token: 'access', refresh_token: 'refresh', expires_in: 3599,
      scope: 'openid https://www.googleapis.com/auth/calendar.events email',
    }));
    await expect(service.exchangeCode('the-code')).resolves.toEqual({
      accessToken: 'access', refreshToken: 'refresh', scopes: ['openid', 'https://www.googleapis.com/auth/calendar.events', 'email'],
    });
    const { url, init } = call();
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(header(init, 'content-type')).toBe('application/x-www-form-urlencoded');
    expect(form(init)).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      code: 'the-code',
      grant_type: 'authorization_code',
      redirect_uri: 'https://api.move.test/api/calendar/oauth/callback',
    });
  });

  it('fails the exchange when Google returns no refresh token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'access' }));
    await expect(service.exchangeCode('the-code')).rejects.toMatchObject({ kind: 'other' });
  });

  it('reads no scopes when Google does not list them', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'access', refresh_token: 'refresh' }));
    await expect(service.exchangeCode('the-code')).resolves.toMatchObject({ scopes: [] });
  });

  it('refreshes the access token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'fresh' }));
    await expect(service.refreshAccessToken('refresh')).resolves.toBe('fresh');
    const { url, init } = call();
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(form(init)).toEqual({
      client_id: 'client-id', client_secret: 'client-secret', refresh_token: 'refresh', grant_type: 'refresh_token',
    });
  });

  it('revokes a token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await service.revoke('refresh');
    const { url, init } = call();
    expect(url).toBe('https://oauth2.googleapis.com/revoke');
    expect(form(init)).toEqual({ token: 'refresh' });
  });

  it('reads the account email with the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { sub: '1', email: 'agenda@move.test' }));
    await expect(service.getAccountEmail('access')).resolves.toBe('agenda@move.test');
    const { url, init } = call();
    expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo');
    expect(init.method).toBe('GET');
    expect(header(init, 'authorization')).toBe('Bearer access');
  });

  it('lists only writable calendars across pages', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [
          { id: 'primary@move.test', summary: 'Agenda', accessRole: 'owner', primary: true },
          { id: 'holidays', summary: 'Feriados', accessRole: 'reader' },
        ],
        nextPageToken: 'page-2',
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        items: [{ id: 'rehab@group', summary: 'Rehab', summaryOverride: 'Rehab MOVE', accessRole: 'writer' }],
      }));

    await expect(service.listCalendars('access')).resolves.toEqual([
      { id: 'primary@move.test', name: 'Agenda', primary: true },
      { id: 'rehab@group', name: 'Rehab MOVE', primary: false },
    ]);
    expect(call(0).url).toBe('https://www.googleapis.com/calendar/v3/users/me/calendarList?');
    expect(call(1).url).toBe('https://www.googleapis.com/calendar/v3/users/me/calendarList?pageToken=page-2');
  });

  it('lists the expanded events of a window across pages', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 'e1' }], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 'e2' }] }));
    const from = new Date('2026-10-14T12:00:00.000Z');
    const to = new Date('2026-10-29T12:00:00.000Z');

    const events = await service.listEvents('access', 'rehab@group', from, to);

    expect(events.map((e) => e.id)).toEqual(['e1', 'e2']);
    const first = new URL(call(0).url);
    expect(first.origin + first.pathname).toBe('https://www.googleapis.com/calendar/v3/calendars/rehab%40group/events');
    expect(Object.fromEntries(first.searchParams)).toEqual({
      timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', maxResults: '250',
    });
    expect(new URL(call(1).url).searchParams.get('pageToken')).toBe('p2');
    expect(header(call(1).init, 'authorization')).toBe('Bearer access');
  });

  // M-6: a pull must not loop (and hold the job lock) on an endless or repeated page token; the last blocks are kept.
  describe('page limit', () => {
    const from = new Date('2026-10-14T12:00:00.000Z');
    const to = new Date('2026-10-29T12:00:00.000Z');

    it('reads at most 10 pages and then fails as transient', async () => {
      let page = 0;
      fetchMock.mockImplementation(async () => {
        page += 1;
        return jsonResponse(200, { items: [{ id: `e${page}` }], nextPageToken: `p${page + 1}` });
      });
      await expect(service.listEvents('access', 'rehab@group', from, to)).rejects.toMatchObject({ kind: 'transient' });
      expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it('reads all 10 pages when the last one ends the list', async () => {
      let page = 0;
      fetchMock.mockImplementation(async () => {
        page += 1;
        return jsonResponse(200, { items: [{ id: `e${page}` }], ...(page < 10 ? { nextPageToken: `p${page + 1}` } : {}) });
      });
      await expect(service.listEvents('access', 'rehab@group', from, to)).resolves.toHaveLength(10);
    });

    it('fails as transient when Google repeats a page token', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(200, { items: [{ id: 'e' }], nextPageToken: 'same' }));
      await expect(service.listEvents('access', 'rehab@group', from, to)).rejects.toMatchObject({ kind: 'transient' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('inserts an event with the MOVE booking id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'moveabc' }));
    await service.insertEvent('access', 'rehab@group', {
      id: 'moveabc',
      summary: 'Rehab · Evaluación — Ana Pérez',
      description: 'Profesional: Fisio\nReserva creada desde MOVE',
      startsAt: new Date('2026-10-15T13:00:00.000Z'),
      endsAt: new Date('2026-10-15T14:00:00.000Z'),
      moveBookingId: 'booking-1',
    });
    const { url, init } = call();
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/rehab%40group/events');
    expect(init.method).toBe('POST');
    expect(header(init, 'content-type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      id: 'moveabc',
      summary: 'Rehab · Evaluación — Ana Pérez',
      description: 'Profesional: Fisio\nReserva creada desde MOVE',
      start: { dateTime: '2026-10-15T13:00:00.000Z', timeZone: 'America/Montevideo' },
      end: { dateTime: '2026-10-15T14:00:00.000Z', timeZone: 'America/Montevideo' },
      extendedProperties: { private: { moveBookingId: 'booking-1' } },
    });
  });

  it('deletes an event', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await service.deleteEvent('access', 'rehab@group', 'moveabc');
    const { url, init } = call();
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/rehab%40group/events/moveabc');
    expect(init.method).toBe('DELETE');
    expect(header(init, 'authorization')).toBe('Bearer access');
  });

  it.each([
    [400, { error: 'invalid_grant' }, 'invalid_grant'],
    [401, { error: { code: 401 } }, 'invalid_grant'],
    [404, {}, 'not_found'],
    [410, {}, 'not_found'],
    [409, {}, 'conflict'],
    [429, {}, 'transient'],
    [500, {}, 'transient'],
    [503, {}, 'transient'],
    [400, { error: 'invalid_request' }, 'other'],
    [403, {}, 'other'],
    [403, { error: { code: 403, errors: [{ reason: 'forbidden' }] } }, 'other'],
    [403, { error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }] } }, 'transient'],
    [403, { error: { code: 403, errors: [{ reason: 'userRateLimitExceeded' }] } }, 'transient'],
  ])('maps HTTP %i %j to %s', async (status, body, kind) => {
    fetchMock.mockResolvedValue(jsonResponse(status, body));
    const error = await service.refreshAccessToken('refresh').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleCalendarError);
    expect(error).toMatchObject({ kind, status });
  });

  it('returns an empty list when Google sends no items', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }));
    await expect(service.listEvents('access', 'rehab@group', new Date(), new Date())).resolves.toEqual([]);
  });

  it.each([
    ['without items', () => jsonResponse(200, { kind: 'calendar#events' })],
    ['with a body that is not JSON', () => new Response('<html>', { status: 200 })],
    ['with a cut body', () => new Response('{"items":[{"id":"e1"', { status: 200 })],
  ])('treats an OK event list %s as transient, never as an empty calendar', async (_case, response) => {
    fetchMock.mockResolvedValue(response());
    await expect(service.listEvents('access', 'rehab@group', new Date(), new Date())).rejects.toMatchObject({
      kind: 'transient',
      status: 200,
    });
  });

  it('treats an OK calendar list without items as transient', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await expect(service.listCalendars('access')).rejects.toMatchObject({ kind: 'transient', status: 200 });
  });

  it('maps network errors and timeouts to transient', async () => {
    fetchMock.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(service.listCalendars('access')).rejects.toMatchObject({ kind: 'transient', status: 0 });
  });

  it('sends every request with a timeout signal', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'fresh' }));
    await service.refreshAccessToken('refresh');
    expect(call().init.signal).toBeInstanceOf(AbortSignal);
  });

  it('never logs tokens or emails', async () => {
    const warn = vi.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_grant', error_description: 'agenda@move.test' }));
    await service.refreshAccessToken('secret-refresh').catch(() => undefined);
    const logged = warn.mock.calls.map(([message]) => message).join('\n');
    expect(logged).toContain('token.refresh');
    expect(logged).not.toContain('secret-refresh');
    expect(logged).not.toContain('agenda@move.test');
  });
});
