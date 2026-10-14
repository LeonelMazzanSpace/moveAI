import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import { appConfig } from '../../../config/app.config.js';
import { calendarConfig, type CalendarConfig } from '../../../config/calendar.config.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { OAUTH_STATE_TTL_MS, signState, verifyState } from '../domain/oauth-state.js';
import { decryptToken, encryptToken } from '../domain/token-cipher.js';
import { CalendarConnection, type StoredConnectionStatus } from '../entities/calendar-connection.entity.js';
import type { CalendarStatusDto, GoogleCalendarOptionDto } from '../models/calendar-status.model.js';
import { GoogleCalendarError, GoogleCalendarService, REQUIRED_CALENDAR_SCOPES } from './google-calendar.service.js';

export interface OAuthCallbackQuery { code: unknown; state: unknown; error: unknown }

export type SyncStamp = 'push' | 'pull';

// Why sync stopped. A lost calendar (D113) names the calendar that failed, so only that calendar is dropped.
export type ReconnectReason =
  | { kind: 'invalid_grant' }
  | { kind: 'calendar_not_found' | 'calendar_forbidden'; calendarId: string };

const toStatus = (configured: boolean, connection: CalendarConnection | null): CalendarStatusDto => ({
  configured,
  status: connection?.status ?? 'disconnected',
  accountEmail: connection?.googleAccountEmail ?? null,
  calendarId: connection?.calendarId ?? null,
  calendarName: connection?.calendarName ?? null,
  lastPushAt: connection?.lastPushAt?.toISOString() ?? null,
  lastPullAt: connection?.lastPullAt?.toISOString() ?? null,
});

// Bookings links and slot blocks belong to one calendar: they are dropped when it changes or the account leaves.
async function resetSync(manager: EntityManager): Promise<void> {
  await manager.query(`DELETE FROM calendar_event_links`);
  await clearBlocks(manager);
}

async function clearBlocks(manager: EntityManager): Promise<void> {
  await manager.query(`UPDATE time_slots SET calendar_blocked_at = NULL WHERE calendar_blocked_at IS NOT NULL`);
}

interface LockedConnection { status: StoredConnectionStatus; calendarId: string | null; refreshTokenEnc: string }

// Every write that changes the connection locks its row before touching links or blocks. A sync holds the same row
// FOR SHARE while it writes (`holdForSync`), so it either commits first (and its writes are cleared here) or runs
// after and sees the change.
async function lockConnection(manager: EntityManager, connectionId: string): Promise<LockedConnection | null> {
  const [row]: LockedConnection[] = await manager.query(
    `SELECT status, calendar_id AS "calendarId", refresh_token_enc AS "refreshTokenEnc"
     FROM calendar_connections WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [connectionId],
  );
  return row ?? null;
}

// D94: the single Google account of MOVE. The refresh token only exists encrypted at rest and is never logged.
@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);

  constructor(
    @InjectRepository(CalendarConnection) private readonly connections: Repository<CalendarConnection>,
    private readonly dataSource: DataSource,
    private readonly google: GoogleCalendarService,
    private readonly notifications: NotificationsService,
    @Inject(calendarConfig.KEY) private readonly config: CalendarConfig,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async getStatus(): Promise<CalendarStatusDto> {
    return toStatus(this.config.configured, await this.findActive());
  }

  startConnect(staffId: string): { authUrl: string } {
    const key = this.configuredKey();
    if (!key) throw new AppError('CALENDAR_NOT_CONFIGURED');
    const state = signState({ staffId, nonce: randomUUID(), exp: Date.now() + OAUTH_STATE_TTL_MS }, key);
    return { authUrl: this.google.buildAuthUrl(state) };
  }

  // Returns where to send the browser; nothing is stored unless the state is valid and Google answers.
  async completeConnect(staffId: string, query: OAuthCallbackQuery): Promise<string> {
    const connected = await this.tryConnect(staffId, query);
    return `${this.app.webUrl}/staff/configuracion?tab=calendario&calendar=${connected ? 'connected' : 'error'}`;
  }

  async listCalendars(): Promise<GoogleCalendarOptionDto[]> {
    return this.calendarsOf(await this.requireConnected());
  }

  async selectCalendar(calendarId: string): Promise<CalendarStatusDto> {
    const connection = await this.requireConnected();
    const calendar = (await this.calendarsOf(connection)).find((option) => option.id === calendarId);
    if (!calendar) throw new AppError('CALENDAR_INVALID_CALENDAR');
    await this.dataSource.transaction(async (manager) => {
      const locked = await lockConnection(manager, connection.id);
      if (locked?.status !== 'connected') throw new AppError('CALENDAR_NOT_CONNECTED');
      if (locked.calendarId !== calendar.id) await resetSync(manager);
      await manager.update(CalendarConnection, connection.id, { calendarId: calendar.id, calendarName: calendar.name });
    });
    return this.getStatus();
  }

  // The token is revoked in Google when possible; the events MOVE already created stay in the calendar. The revoke runs
  // after the connection is gone (M-3), so a pass that gets the resulting invalid_grant finds nothing to mark.
  async disconnect(): Promise<CalendarStatusDto> {
    const connection = await this.findActive();
    if (connection) {
      const refreshTokenEnc = await this.dataSource.transaction(async (manager) => {
        const locked = await lockConnection(manager, connection.id);
        if (!locked) return null;
        await resetSync(manager);
        await manager.update(CalendarConnection, connection.id, { refreshTokenEnc: '' });
        await manager.softDelete(CalendarConnection, connection.id);
        return locked.refreshTokenEnc;
      });
      if (refreshTokenEnc) await this.revokeStored(refreshTokenEnc);
    }
    return this.getStatus();
  }

  // Connected with a calendar chosen: the only state in which push and pull run.
  async findSyncable(): Promise<(CalendarConnection & { calendarId: string }) | null> {
    const connection = await this.findActive();
    if (!connection || connection.status !== 'connected' || !connection.calendarId) return null;
    return connection as CalendarConnection & { calendarId: string };
  }

  // Called first in the transaction of any sync write that depends on the connection read before calling Google:
  // false (skip the write) when the connection was deleted, lost access or moved to another calendar meanwhile.
  async holdForSync(manager: EntityManager, connectionId: string, calendarId: string): Promise<boolean> {
    const rows: unknown[] = await manager.query(
      `SELECT 1 FROM calendar_connections
       WHERE id = $1 AND status = 'connected' AND calendar_id = $2 AND deleted_at IS NULL
       FOR SHARE`,
      [connectionId, calendarId],
    );
    return rows.length > 0;
  }

  // A token that no longer decrypts (key rotated) can only be fixed by reconnecting, like a revoked grant.
  async accessToken(connection: CalendarConnection): Promise<string> {
    const key = this.configuredKey();
    if (!key) throw new GoogleCalendarError('invalid_grant', 0);
    let refreshToken: string;
    try {
      refreshToken = decryptToken(connection.refreshTokenEnc, key);
    } catch {
      throw new GoogleCalendarError('invalid_grant', 0);
    }
    return this.google.refreshAccessToken(refreshToken);
  }

  async recordRun(connectionId: string, stamp: SyncStamp, errorCode: string | null): Promise<void> {
    const column = stamp === 'push' ? 'last_push_at' : 'last_pull_at';
    await this.dataSource.query(
      `UPDATE calendar_connections SET ${column} = now(), last_error_code = $2, updated_at = now() WHERE id = $1`,
      [connectionId, errorCode],
    );
  }

  async recordError(connectionId: string, errorCode: string): Promise<void> {
    await this.dataSource.query(`UPDATE calendar_connections SET last_error_code = $2, updated_at = now() WHERE id = $1`, [
      connectionId,
      errorCode,
    ]);
  }

  // Sync pauses, every slot is freed and staff is told to reconnect (once per connection, day and reason, D115). The UPDATE
  // locks the connection row before anything is cleared. Only if the connection still holds the token the failing
  // pass used (M-3): an answer about an older token says nothing about a reconnect made meanwhile.
  // - invalid_grant: the calendar and the links are kept, so reconnecting the same account resumes where it stopped.
  // - lost calendar (D113): only if the connection still points to the calendar that failed (a 404 for a calendar staff
  //   already replaced changes nothing). The calendar and its links are dropped, so a reconnect lands in "connected
  //   without a calendar" and staff picks one.
  // Returns whether the connection changed.
  async markNeedsReconnect(
    connection: Pick<CalendarConnection, 'id' | 'refreshTokenEnc'>,
    reason: ReconnectReason = { kind: 'invalid_grant' },
  ): Promise<boolean> {
    const lostCalendar = reason.kind !== 'invalid_grant';
    const changed = await this.dataSource.transaction(async (manager) => {
      const rows: { id: string }[] = await manager.query(
        `WITH changed AS (
           UPDATE calendar_connections
           SET status = 'needs_reconnect', last_error_code = $2, updated_at = now(),
             calendar_id = CASE WHEN $3::text IS NULL THEN calendar_id END,
             calendar_name = CASE WHEN $3::text IS NULL THEN calendar_name END
           WHERE id = $1 AND status = 'connected' AND deleted_at IS NULL AND ($3::text IS NULL OR calendar_id = $3)
             AND refresh_token_enc = $4
           RETURNING id
         ) SELECT id FROM changed`,
        [connection.id, reason.kind, lostCalendar ? reason.calendarId : null, connection.refreshTokenEnc],
      );
      if (rows.length === 0) return false;
      await (lostCalendar ? resetSync(manager) : clearBlocks(manager));
      return true;
    });
    if (!changed) return false;
    this.logger.warn(`calendar connection ${connection.id} needs reconnect: ${reason.kind}`);
    await this.notifyDisconnected(connection.id, reason.kind);
    return true;
  }

  // M-5: Google keeps failing with an error that is neither transient nor a lost grant or calendar (for example a
  // misconfigured OAuth client). The blocks can no longer be trusted, so every slot is freed and staff is told; the
  // connection stays as it is, and a pull that works again blocks what is busy.
  async releaseBlocksAfterPersistentError(connectionId: string): Promise<void> {
    const released = await this.dataSource.transaction(async (manager) => {
      const locked = await lockConnection(manager, connectionId);
      if (locked?.status !== 'connected') return false;
      await clearBlocks(manager);
      return true;
    });
    if (!released) return;
    this.logger.warn(`calendar connection ${connectionId} blocks released: persistent error`);
    await this.notifyDisconnected(connectionId, 'other');
  }

  private async notifyDisconnected(connectionId: string, kind: ReconnectReason['kind'] | 'other'): Promise<void> {
    await this.notifications.sendToStaff({
      template: 'staff-calendar-disconnected',
      idempotencyKey: `staff-calendar-disconnected:${connectionId}:${businessToday()}:${kind}`,
      params: { configUrl: `${this.app.webUrl}/staff/configuracion?tab=calendario` },
    });
  }

  private async tryConnect(staffId: string, query: OAuthCallbackQuery): Promise<boolean> {
    const key = this.configuredKey();
    const { code, state, error } = query;
    if (!key || error !== undefined || typeof code !== 'string' || typeof state !== 'string') return false;
    if (!verifyState(state, key, staffId, new Date())) return false;
    try {
      const tokens = await this.google.exchangeCode(code);
      if (!REQUIRED_CALENDAR_SCOPES.every((scope) => tokens.scopes.includes(scope))) {
        // M-7: staff unticked a calendar permission; a connection that cannot list calendars or write events is useless.
        this.logger.warn(`calendar connect refused staff=${staffId}: calendar scope not granted`);
        await this.revoke(tokens.refreshToken);
        return false;
      }
      const email = await this.google.getAccountEmail(tokens.accessToken);
      await this.saveConnection(staffId, email, encryptToken(tokens.refreshToken, key));
      return true;
    } catch (failure) {
      this.logger.warn(`calendar connect failed staff=${staffId}: ${failure instanceof GoogleCalendarError ? failure.kind : 'internal'}`);
      return false;
    }
  }

  // Reconnecting the same account keeps the calendar and the links, so pending events are created on the next push.
  private async saveConnection(staffId: string, email: string, refreshTokenEnc: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext('calendar-connection'))`);
      const repository = manager.getRepository(CalendarConnection);
      const current = await repository.findOne({ where: {}, order: { createdAt: 'DESC' }, lock: { mode: 'pessimistic_write' } });
      const fields = { googleAccountEmail: email, refreshTokenEnc, status: 'connected' as const, lastErrorCode: null, connectedBy: staffId };
      if (!current) {
        await repository.insert({ ...fields, calendarId: null, calendarName: null });
        return;
      }
      const sameAccount = current.googleAccountEmail === email;
      if (!sameAccount) await resetSync(manager);
      await repository.update(current.id, sameAccount ? fields : { ...fields, calendarId: null, calendarName: null });
    });
  }

  private async revokeStored(refreshTokenEnc: string): Promise<void> {
    const key = this.configuredKey();
    if (!key || refreshTokenEnc === '') return;
    let refreshToken: string;
    try {
      refreshToken = decryptToken(refreshTokenEnc, key);
    } catch {
      this.logger.warn('calendar revoke failed: internal');
      return;
    }
    await this.revoke(refreshToken);
  }

  // Best effort: a failure is only logged.
  private async revoke(refreshToken: string): Promise<void> {
    try {
      await this.google.revoke(refreshToken);
    } catch (failure) {
      this.logger.warn(`calendar revoke failed: ${failure instanceof GoogleCalendarError ? failure.kind : 'internal'}`);
    }
  }

  private async requireConnected(): Promise<CalendarConnection> {
    const connection = await this.findActive();
    if (!connection || connection.status !== 'connected') throw new AppError('CALENDAR_NOT_CONNECTED');
    return connection;
  }

  private async calendarsOf(connection: CalendarConnection): Promise<GoogleCalendarOptionDto[]> {
    try {
      return await this.google.listCalendars(await this.accessToken(connection));
    } catch (error) {
      if (!(error instanceof GoogleCalendarError)) throw error;
      if (error.kind !== 'invalid_grant') throw new AppError('CALENDAR_PROVIDER_ERROR');
      await this.markNeedsReconnect(connection);
      throw new AppError('CALENDAR_NOT_CONNECTED');
    }
  }

  private findActive(): Promise<CalendarConnection | null> {
    return this.connections.findOne({ where: {}, order: { createdAt: 'DESC' } });
  }

  private configuredKey(): Buffer | null {
    return this.config.configured ? this.config.tokenKey : null;
  }
}
