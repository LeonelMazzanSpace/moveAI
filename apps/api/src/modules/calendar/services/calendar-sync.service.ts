import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BUSINESS_TZ, businessTime, toBusinessDate } from '../../../common/time/business-time.js';
import { displayDate } from '../../bookings/domain/booking-rules.js';
import type { BookingSource } from '../../bookings/entities/booking.entity.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { busyIntervals, overlaps, type BusyInterval } from '../domain/busy-intervals.js';
import type { CalendarConnection } from '../entities/calendar-connection.entity.js';
import { CalendarConnectionService, type SyncStamp } from './calendar-connection.service.js';
import { GoogleCalendarError, GoogleCalendarService } from './google-calendar.service.js';

const DAY_MS = 86_400_000;
// Items per pass; the rest go in the next pass.
const BATCH = 200;

type SyncResult = Record<string, number>;

interface PushRow {
  id: string;
  source: BookingSource;
  startsAt: Date;
  endsAt: Date;
  clientName: string;
  professionalName: string | null;
}

interface StaleLink { id: string; googleEventId: string }

interface ConflictRow { slotId: string; startsAt: Date; clientName: string; professionalName: string | null }

// Google event ids only take base32hex characters (0-9, a-v); `move` plus the uuid without dashes is one of them.
const eventIdOf = (bookingId: string): string => `move${bookingId.replaceAll('-', '')}`;

const summaryOf = (row: PushRow): string =>
  `Rehab · ${row.source === 'payment' ? 'Evaluación' : 'Seguimiento'} — ${row.clientName}`;

const descriptionOf = (row: PushRow): string =>
  [...(row.professionalName ? [`Profesional: ${row.professionalName}`] : []), 'Reserva creada desde MOVE'].join('\n');

const isInvalidGrant = (error: unknown): boolean => error instanceof GoogleCalendarError && error.kind === 'invalid_grant';

// Item errors are retried on the next pass and never touch the booking; an invalid grant stops the pass.
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly connections: CalendarConnectionService,
    private readonly google: GoogleCalendarService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  // MOVE → Google: one event per confirmed Rehab booking that has not ended; events of bookings no longer confirmed are deleted.
  async push(): Promise<SyncResult> {
    return this.withConnection('push', async (connection, accessToken) => {
      const result = { created: 0, deleted: 0, failed: 0 };
      let lastError: string | null = null;
      const track = (error: unknown): void => {
        if (isInvalidGrant(error) || !(error instanceof GoogleCalendarError)) throw error;
        result.failed += 1;
        lastError = error.kind;
      };

      for (const row of await this.bookingsToPush()) {
        try {
          await this.createEvent(accessToken, connection.calendarId, row);
          result.created += 1;
        } catch (error) {
          track(error);
        }
      }
      for (const link of await this.staleLinks()) {
        try {
          await this.deleteEvent(accessToken, connection.calendarId, link);
          result.deleted += 1;
        } catch (error) {
          track(error);
        }
      }
      return { result, errorCode: lastError };
    });
  }

  // Google → MOVE: Rehab slots of the window that overlap a busy event are blocked, the others released.
  async pull(): Promise<SyncResult> {
    return this.withConnection('pull', async (connection, accessToken) => {
      const windowDays = await this.settings.get('bookingWindowDays');
      const from = new Date();
      const to = new Date(from.getTime() + (windowDays + 1) * DAY_MS);
      const events = await this.google.listEvents(accessToken, connection.calendarId, from, to);
      const { blocked, released, conflicts } = await this.applyBlocks(from, to, busyIntervals(events, connection.calendarId, BUSINESS_TZ));
      for (const conflict of conflicts) await this.notifyConflict(conflict);
      return { result: { blocked, released, conflicts: conflicts.length }, errorCode: null };
    });
  }

  private async withConnection(
    stamp: SyncStamp,
    run: (
      connection: CalendarConnection & { calendarId: string },
      accessToken: string,
    ) => Promise<{ result: SyncResult; errorCode: string | null }>,
  ): Promise<SyncResult> {
    const connection = await this.connections.findSyncable();
    if (!connection) return {};
    try {
      const { result, errorCode } = await run(connection, await this.connections.accessToken(connection));
      await this.connections.recordRun(connection.id, stamp, errorCode);
      return result;
    } catch (error) {
      if (!(error instanceof GoogleCalendarError)) throw error;
      if (error.kind === 'invalid_grant') {
        await this.connections.markNeedsReconnect(connection.id);
        return { reconnect: 1 };
      }
      // Transient errors keep the last blocks; the next pass retries.
      await this.connections.recordError(connection.id, error.kind);
      return { failed: 1 };
    }
  }

  private bookingsToPush(): Promise<PushRow[]> {
    return this.dataSource.query(
      `SELECT b.id, b.source, s.starts_at AS "startsAt", s.ends_at AS "endsAt", u.name AS "clientName",
         p.name AS "professionalName"
       FROM bookings b
       JOIN time_slots s ON s.id = b.time_slot_id
       JOIN users u ON u.id = b.user_id
       LEFT JOIN professionals p ON p.id = s.professional_id
       LEFT JOIN calendar_event_links l ON l.booking_id = b.id
       WHERE s.service = 'rehab' AND b.status = 'confirmed' AND b.deleted_at IS NULL AND s.ends_at > now() AND l.id IS NULL
       ORDER BY s.starts_at
       LIMIT ${BATCH}`,
    );
  }

  private staleLinks(): Promise<StaleLink[]> {
    return this.dataSource.query(
      `SELECT l.id, l.google_event_id AS "googleEventId"
       FROM calendar_event_links l
       JOIN bookings b ON b.id = l.booking_id
       WHERE b.status <> 'confirmed' OR b.deleted_at IS NOT NULL
       ORDER BY l.created_at
       LIMIT ${BATCH}`,
    );
  }

  // The id is deterministic, so a 409 means the event of a previous pass already exists: only the link was missing.
  private async createEvent(accessToken: string, calendarId: string, row: PushRow): Promise<void> {
    const eventId = eventIdOf(row.id);
    try {
      await this.google.insertEvent(accessToken, calendarId, {
        id: eventId,
        summary: summaryOf(row),
        description: descriptionOf(row),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        moveBookingId: row.id,
      });
    } catch (error) {
      if (!(error instanceof GoogleCalendarError && error.kind === 'conflict')) throw error;
    }
    await this.dataSource.query(
      `INSERT INTO calendar_event_links (booking_id, google_event_id) VALUES ($1, $2) ON CONFLICT (booking_id) DO NOTHING`,
      [row.id, eventId],
    );
  }

  // An event already gone in Google (404/410) counts as deleted.
  private async deleteEvent(accessToken: string, calendarId: string, link: StaleLink): Promise<void> {
    try {
      await this.google.deleteEvent(accessToken, calendarId, link.googleEventId);
    } catch (error) {
      if (!(error instanceof GoogleCalendarError && error.kind === 'not_found')) throw error;
    }
    await this.dataSource.query(`DELETE FROM calendar_event_links WHERE id = $1`, [link.id]);
  }

  // One UPDATE per pass. It waits on the lock of any slot a booking holds, and the conflict query runs as a later
  // statement, so it sees every booking committed before the block: a booking either lands before the block (and is
  // reported here) or after it (and is rejected with SLOT_NOT_BOOKABLE).
  private async applyBlocks(
    from: Date,
    to: Date,
    intervals: BusyInterval[],
  ): Promise<{ blocked: number; released: number; conflicts: ConflictRow[] }> {
    return this.dataSource.transaction(async (manager) => {
      const slots: { id: string; startsAt: Date; endsAt: Date }[] = await manager.query(
        `SELECT id, starts_at AS "startsAt", ends_at AS "endsAt" FROM time_slots
         WHERE service = 'rehab' AND cancelled_at IS NULL AND starts_at >= $1 AND starts_at < $2`,
        [from, to],
      );
      const busyIds = slots.filter((slot) => overlaps(slot, intervals)).map((slot) => slot.id);
      const changed: { id: string; blocked: boolean }[] = await manager.query(
        `WITH changed AS (
           UPDATE time_slots
           SET calendar_blocked_at = CASE WHEN id = ANY($3::uuid[]) THEN now() ELSE NULL END
           WHERE service = 'rehab' AND cancelled_at IS NULL AND starts_at >= $1 AND starts_at < $2
             AND (calendar_blocked_at IS NOT NULL) <> (id = ANY($3::uuid[]))
           RETURNING id, calendar_blocked_at IS NOT NULL AS blocked
         ) SELECT id, blocked FROM changed`,
        [from, to, busyIds],
      );
      const newlyBlocked = changed.filter((row) => row.blocked).map((row) => row.id);
      const conflicts: ConflictRow[] =
        newlyBlocked.length === 0
          ? []
          : await manager.query(
              `SELECT DISTINCT ON (s.id) s.id AS "slotId", s.starts_at AS "startsAt", u.name AS "clientName",
                 p.name AS "professionalName"
               FROM bookings b
               JOIN time_slots s ON s.id = b.time_slot_id
               JOIN users u ON u.id = b.user_id
               LEFT JOIN professionals p ON p.id = s.professional_id
               WHERE b.time_slot_id = ANY($1::uuid[]) AND b.status IN ('pending_payment','confirmed') AND b.deleted_at IS NULL
               ORDER BY s.id, b.created_at`,
              [newlyBlocked],
            );
      return { blocked: newlyBlocked.length, released: changed.length - newlyBlocked.length, conflicts };
    });
  }

  // D95: the booking stays; staff is told once per slot.
  private async notifyConflict(conflict: ConflictRow): Promise<void> {
    this.logger.warn(`calendar conflict slot=${conflict.slotId}`);
    await this.notifications.sendToStaff({
      template: 'staff-calendar-conflict',
      idempotencyKey: `staff-calendar-conflict:${conflict.slotId}`,
      params: {
        clientName: conflict.clientName,
        professionalName: conflict.professionalName,
        date: displayDate(toBusinessDate(conflict.startsAt)),
        time: businessTime(conflict.startsAt),
      },
    });
  }
}
