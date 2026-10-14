// Response shapes of the Feedback contract (Paquete D).

export type CalendarConnectionStatus = 'disconnected' | 'connected' | 'needs_reconnect';

export interface CalendarStatusDto {
  configured: boolean;
  status: CalendarConnectionStatus;
  accountEmail: string | null;
  calendarId: string | null;
  calendarName: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
}

export interface GoogleCalendarOptionDto { id: string; name: string; primary: boolean }
