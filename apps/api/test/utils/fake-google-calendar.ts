import type { GoogleEvent } from '../../src/modules/calendar/domain/busy-intervals.js';
import type { GoogleCalendarOptionDto } from '../../src/modules/calendar/models/calendar-status.model.js';
import {
  GoogleCalendarError, type GoogleCalendarErrorKind, type GoogleCalendarService, type GoogleTokens, type NewCalendarEvent,
} from '../../src/modules/calendar/services/google-calendar.service.js';

export type Method = Exclude<keyof GoogleCalendarService, 'buildAuthUrl'>;

export type FakeEvent = GoogleEvent & { summary?: string; description?: string };

const ALL_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

const STATUS: Record<GoogleCalendarErrorKind, number> = {
  invalid_grant: 400, not_found: 404, conflict: 409, transient: 503, other: 403,
};

// In-memory Google Calendar for `overrideProvider(GoogleCalendarService)`. `failWith` injects an error in every call of
// one method (or all of them) until `clearFailures`.
export class FakeGoogleCalendar implements Pick<GoogleCalendarService, keyof GoogleCalendarService> {
  accountEmail = 'agenda@move.test';
  calendars: (GoogleCalendarOptionDto & { accessRole: string })[] = [
    { id: 'rehab@group.calendar.google.com', name: 'Rehab MOVE', primary: false, accessRole: 'owner' },
    { id: 'agenda@move.test', name: 'Agenda', primary: true, accessRole: 'writer' },
  ];
  readonly events = new Map<string, Map<string, FakeEvent>>();
  readonly revoked: string[] = [];
  readonly inserted: string[] = [];
  readonly refreshedWith: string[] = [];
  // Scopes staff grants on the consent screen; null = everything MOVE asks for.
  grantedScopes: string[] | null = null;
  private readonly failures = new Map<Method | '*', GoogleCalendarErrorKind>();
  private readonly holds = new Map<Method, { arrived: () => void; released: Promise<void> }>();

  // The next call of `method` stops until `release`; `reached` resolves once a call is waiting there.
  hold(method: Method): { reached: Promise<void>; release: () => void } {
    let arrived = (): void => undefined;
    let release = (): void => undefined;
    const reached = new Promise<void>((resolve) => { arrived = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    this.holds.set(method, { arrived, released });
    return { reached, release };
  }

  failWith(kind: GoogleCalendarErrorKind, method: Method | '*' = '*'): void {
    this.failures.set(method, kind);
  }

  clearFailures(): void {
    this.failures.clear();
  }

  reset(): void {
    this.holds.clear();
    this.events.clear();
    this.revoked.length = 0;
    this.inserted.length = 0;
    this.refreshedWith.length = 0;
    this.grantedScopes = null;
    this.clearFailures();
  }

  // Someone else's event, busy unless `extra` says otherwise.
  addEvent(calendarId: string, startsAt: Date, endsAt: Date, extra: Partial<GoogleEvent> = {}): string {
    const id = `ext${this.calendarEvents(calendarId).size + 1}`;
    this.calendarEvents(calendarId).set(id, {
      id, status: 'confirmed', start: { dateTime: startsAt.toISOString() }, end: { dateTime: endsAt.toISOString() }, ...extra,
    });
    return id;
  }

  removeEvent(calendarId: string, eventId: string): void {
    this.calendarEvents(calendarId).delete(eventId);
  }

  calendarEvents(calendarId: string): Map<string, FakeEvent> {
    let events = this.events.get(calendarId);
    if (!events) {
      events = new Map();
      this.events.set(calendarId, events);
    }
    return events;
  }

  buildAuthUrl(state: string): string {
    return `https://accounts.google.test/auth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    this.fail('exchangeCode');
    return { accessToken: `access-${code}`, refreshToken: `1//refresh-${code}`, scopes: this.grantedScopes ?? [...ALL_SCOPES] };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    this.fail('refreshAccessToken');
    this.refreshedWith.push(refreshToken);
    return `access-${refreshToken}`;
  }

  async revoke(token: string): Promise<void> {
    await this.wait('revoke');
    this.fail('revoke');
    this.revoked.push(token);
  }

  async getAccountEmail(): Promise<string> {
    this.fail('getAccountEmail');
    return this.accountEmail;
  }

  async listCalendars(): Promise<GoogleCalendarOptionDto[]> {
    this.fail('listCalendars');
    return this.calendars.map(({ id, name, primary }) => ({ id, name, primary }));
  }

  async listEvents(_accessToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
    await this.wait('listEvents');
    this.fail('listEvents');
    return [...this.calendarEvents(calendarId).values()].filter((event) => {
      const start = new Date(event.start?.dateTime ?? `${event.start?.date}T00:00:00-03:00`);
      const end = new Date(event.end?.dateTime ?? `${event.end?.date}T00:00:00-03:00`);
      return start < timeMax && end > timeMin;
    });
  }

  async insertEvent(_accessToken: string, calendarId: string, event: NewCalendarEvent): Promise<void> {
    await this.wait('insertEvent');
    this.fail('insertEvent');
    const events = this.calendarEvents(calendarId);
    if (events.has(event.id)) throw new GoogleCalendarError('conflict', 409);
    this.inserted.push(event.id);
    events.set(event.id, {
      id: event.id,
      status: 'confirmed',
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startsAt.toISOString() },
      end: { dateTime: event.endsAt.toISOString() },
      extendedProperties: { private: { moveBookingId: event.moveBookingId } },
    });
  }

  async deleteEvent(_accessToken: string, calendarId: string, eventId: string): Promise<void> {
    this.fail('deleteEvent');
    if (!this.calendarEvents(calendarId).delete(eventId)) throw new GoogleCalendarError('not_found', 404);
  }

  private async wait(method: Method): Promise<void> {
    const hold = this.holds.get(method);
    if (!hold) return;
    this.holds.delete(method);
    hold.arrived();
    await hold.released;
  }

  private fail(method: Method): void {
    const kind = this.failures.get(method) ?? this.failures.get('*');
    if (kind) throw new GoogleCalendarError(kind, STATUS[kind]);
  }
}
