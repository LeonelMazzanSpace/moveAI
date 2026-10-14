import { Inject, Injectable, Logger } from '@nestjs/common';
import { calendarConfig, type CalendarConfig } from '../../../config/calendar.config.js';
import { BUSINESS_TZ } from '../../../common/time/business-time.js';
import type { GoogleEvent } from '../domain/busy-intervals.js';
import type { GoogleCalendarOptionDto } from '../models/calendar-status.model.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEOUT_MS = 10_000;
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];
const WRITABLE_ROLES = ['owner', 'writer'];

export type GoogleCalendarErrorKind = 'invalid_grant' | 'not_found' | 'conflict' | 'transient' | 'other';

// `status` is the HTTP status (0 when the request never got an answer).
export class GoogleCalendarError extends Error {
  constructor(
    public readonly kind: GoogleCalendarErrorKind,
    public readonly status: number,
  ) {
    super(`google calendar ${kind} (${status})`);
    this.name = 'GoogleCalendarError';
  }
}

export interface GoogleTokens { accessToken: string; refreshToken: string }

export interface NewCalendarEvent {
  id: string;
  summary: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  moveBookingId: string;
}

interface Call {
  op: string;
  url: string;
  method?: 'GET' | 'POST' | 'DELETE';
  accessToken?: string;
  form?: Record<string, string>;
  json?: object;
}

// Google answers some rate limits with 403 instead of 429.
const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded'];

const isRateLimited = (error: unknown): boolean => {
  const errors = typeof error === 'object' && error !== null ? (error as { errors?: unknown }).errors : undefined;
  return Array.isArray(errors) && errors.some((item: { reason?: unknown }) => RATE_LIMIT_REASONS.includes(String(item?.reason)));
};

// A 401 comes right after refreshing the access token, so the grant itself no longer works.
const errorKind = (status: number, body: unknown): GoogleCalendarErrorKind => {
  const code = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  if ((status === 400 && code === 'invalid_grant') || status === 401) return 'invalid_grant';
  if (status === 403 && isRateLimited(code)) return 'transient';
  if (status === 404 || status === 410) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429 || status >= 500) return 'transient';
  return 'other';
};

const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

// The only place that talks to Google (D17: REST with native fetch). Logs carry the operation and the status only:
// never tokens, emails, names or calendar ids.
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(@Inject(calendarConfig.KEY) private readonly config: CalendarConfig) {}

  buildAuthUrl(state: string): string {
    const query = new URLSearchParams({
      client_id: this.config.clientId ?? '',
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${AUTH_URL}?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    const body = await this.request({
      op: 'token.code',
      url: TOKEN_URL,
      form: { ...this.client(), code, grant_type: 'authorization_code', redirect_uri: this.config.redirectUri },
    });
    const accessToken = str(body.access_token);
    const refreshToken = str(body.refresh_token);
    if (!accessToken || !refreshToken) throw new GoogleCalendarError('other', 200);
    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const body = await this.request({
      op: 'token.refresh',
      url: TOKEN_URL,
      form: { ...this.client(), refresh_token: refreshToken, grant_type: 'refresh_token' },
    });
    const accessToken = str(body.access_token);
    if (!accessToken) throw new GoogleCalendarError('other', 200);
    return accessToken;
  }

  async revoke(token: string): Promise<void> {
    await this.request({ op: 'token.revoke', url: REVOKE_URL, form: { token } });
  }

  async getAccountEmail(accessToken: string): Promise<string> {
    const email = str((await this.request({ op: 'userinfo', url: USERINFO_URL, accessToken })).email);
    if (!email) throw new GoogleCalendarError('other', 200);
    return email;
  }

  // Only calendars where MOVE can create events.
  async listCalendars(accessToken: string): Promise<GoogleCalendarOptionDto[]> {
    const items = await this.paginate('calendarList.list', `${CALENDAR_API}/users/me/calendarList`, {}, accessToken);
    return items.flatMap((item) => {
      const id = str(item.id);
      if (!id || !WRITABLE_ROLES.includes(String(item.accessRole))) return [];
      return [{ id, name: str(item.summaryOverride) ?? str(item.summary) ?? id, primary: item.primary === true }];
    });
  }

  async listEvents(accessToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
    const items = await this.paginate(
      'events.list',
      this.eventsUrl(calendarId),
      { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', maxResults: '2500' },
      accessToken,
    );
    return items.filter((item) => typeof item.id === 'string') as unknown as GoogleEvent[];
  }

  async insertEvent(accessToken: string, calendarId: string, event: NewCalendarEvent): Promise<void> {
    await this.request({
      op: 'events.insert',
      url: this.eventsUrl(calendarId),
      method: 'POST',
      accessToken,
      json: {
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startsAt.toISOString(), timeZone: BUSINESS_TZ },
        end: { dateTime: event.endsAt.toISOString(), timeZone: BUSINESS_TZ },
        extendedProperties: { private: { moveBookingId: event.moveBookingId } },
      },
    });
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    await this.request({
      op: 'events.delete',
      url: `${this.eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`,
      method: 'DELETE',
      accessToken,
    });
  }

  private client(): Record<string, string> {
    return { client_id: this.config.clientId ?? '', client_secret: this.config.clientSecret ?? '' };
  }

  private eventsUrl(calendarId: string): string {
    return `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  }

  private async paginate(
    op: string,
    url: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let pageToken: string | null = null;
    do {
      const query = new URLSearchParams({ ...params, ...(pageToken ? { pageToken } : {}) });
      const { status, body } = await this.send({ op, url: `${url}?${query.toString()}`, accessToken });
      // Google always sends `items` (empty when there is nothing). Without it the body was not read (cut or not JSON):
      // taking it as an empty list would release every block, so it is retried like any transient error.
      if (!Array.isArray(body.items)) {
        this.logger.warn(`google ${op} failed: ${status} unreadable body`);
        throw new GoogleCalendarError('transient', status);
      }
      items.push(...(body.items as Record<string, unknown>[]));
      pageToken = str(body.nextPageToken);
    } while (pageToken);
    return items;
  }

  private async request(call: Call): Promise<Record<string, unknown>> {
    return (await this.send(call)).body;
  }

  private async send(call: Call): Promise<{ status: number; body: Record<string, unknown> }> {
    const method = call.method ?? (call.form || call.json ? 'POST' : 'GET');
    const headers: Record<string, string> = { accept: 'application/json' };
    if (call.accessToken) headers.authorization = `Bearer ${call.accessToken}`;
    let payload: string | undefined;
    if (call.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams(call.form).toString();
    } else if (call.json) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(call.json);
    }

    let response: Response;
    try {
      response = await fetch(call.url, { method, headers, body: payload, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      this.logger.warn(`google ${call.op} failed: network`);
      throw new GoogleCalendarError('transient', 0);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const kind = errorKind(response.status, body);
      this.logger.warn(`google ${call.op} failed: ${response.status} ${kind}`);
      throw new GoogleCalendarError(kind, response.status);
    }
    return { status: response.status, body: typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {} };
  }
}
