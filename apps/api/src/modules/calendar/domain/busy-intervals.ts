import { TZDate } from '@date-fns/tz';

// The fields MOVE reads from a Google Calendar event (events.list with `singleEvents=true`).
export interface GoogleEvent {
  id: string;
  status?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
}

export interface BusyInterval { start: Date; end: Date }

const BUSY_STATUSES = ['confirmed', 'tentative'];

// All-day events carry a date (`YYYY-MM-DD`, end exclusive) that covers the whole day in `tz`.
const toInstant = (time: { date?: string; dateTime?: string } | undefined, tz: string): Date | null => {
  if (time?.dateTime) {
    const instant = new Date(time.dateTime);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }
  if (time?.date && /^\d{4}-\d{2}-\d{2}$/.test(time.date)) {
    const [y, m, d] = time.date.split('-').map(Number);
    return new Date(new TZDate(y, m - 1, d, tz).getTime());
  }
  return null;
};

const declinedByCalendar = (event: GoogleEvent, calendarId: string): boolean =>
  (event.attendees ?? []).some(
    (attendee) => (attendee.self === true || attendee.email === calendarId) && attendee.responseStatus === 'declined',
  );

const isBusy = (event: GoogleEvent, calendarId: string): boolean =>
  BUSY_STATUSES.includes(event.status ?? '') &&
  event.transparency !== 'transparent' &&
  event.extendedProperties?.private?.moveBookingId === undefined &&
  !declinedByCalendar(event, calendarId);

// Google → MOVE: the busy time of the calendar, without MOVE's own events.
export function busyIntervals(events: GoogleEvent[], calendarId: string, tz: string): BusyInterval[] {
  const intervals: BusyInterval[] = [];
  for (const event of events) {
    if (!isBusy(event, calendarId)) continue;
    const start = toInstant(event.start, tz);
    const end = toInstant(event.end, tz);
    if (start && end && end.getTime() > start.getTime()) intervals.push({ start, end });
  }
  return intervals;
}

// Intervals that only touch the slot (end = start) do not block it.
export function overlaps(slot: { startsAt: Date; endsAt: Date }, intervals: BusyInterval[]): boolean {
  return intervals.some(
    (interval) => interval.start.getTime() < slot.endsAt.getTime() && interval.end.getTime() > slot.startsAt.getTime(),
  );
}
