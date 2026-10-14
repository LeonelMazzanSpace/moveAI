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
import { CalendarConnection } from '../entities/calendar-connection.entity.js';
import type { CalendarStatusDto, GoogleCalendarOptionDto } from '../models/calendar-status.model.js';
import { GoogleCalendarError, GoogleCalendarService } from './google-calendar.service.js';

export interface OAuthCallbackQuery { code: unknown; state: unknown; error: unknown }

export type SyncStamp = 'push' | 'pull';

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
      if (connection.calendarId !== calendar.id) await resetSync(manager);
      await manager.update(CalendarConnection, connection.id, { calendarId: calendar.id, calendarName: calendar.name });
    });
    return this.getStatus();
  }

  // The token is revoked in Google when possible; the events MOVE already created stay in the calendar.
  async disconnect(): Promise<CalendarStatusDto> {
    const connection = await this.findActive();
    if (connection) {
      await this.revoke(connection);
      await this.dataSource.transaction(async (manager) => {
        await resetSync(manager);
        await manager.update(CalendarConnection, connection.id, { refreshTokenEnc: '' });
        await manager.softDelete(CalendarConnection, connection.id);
      });
    }
    return this.getStatus();
  }

  // Connected with a calendar chosen: the only state in which push and pull run.
  async findSyncable(): Promise<(CalendarConnection & { calendarId: string }) | null> {
    const connection = await this.findActive();
    if (!connection || connection.status !== 'connected' || !connection.calendarId) return null;
    return connection as CalendarConnection & { calendarId: string };
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

  // The grant no longer works: sync pauses, every slot is freed and staff is told to reconnect (once per connection and day).
  async markNeedsReconnect(connectionId: string): Promise<void> {
    const changed = await this.dataSource.transaction(async (manager) => {
      const rows: { id: string }[] = await manager.query(
        `WITH changed AS (
           UPDATE calendar_connections SET status = 'needs_reconnect', last_error_code = 'invalid_grant', updated_at = now()
           WHERE id = $1 AND status = 'connected' AND deleted_at IS NULL
           RETURNING id
         ) SELECT id FROM changed`,
        [connectionId],
      );
      if (rows.length > 0) await clearBlocks(manager);
      return rows.length > 0;
    });
    if (!changed) return;
    this.logger.warn(`calendar connection ${connectionId} needs reconnect`);
    await this.notifications.sendToStaff({
      template: 'staff-calendar-disconnected',
      idempotencyKey: `staff-calendar-disconnected:${connectionId}:${businessToday()}`,
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
      const current = await repository.findOne({ where: {}, order: { createdAt: 'DESC' } });
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

  private async revoke(connection: CalendarConnection): Promise<void> {
    const key = this.configuredKey();
    if (!key || connection.refreshTokenEnc === '') return;
    try {
      await this.google.revoke(decryptToken(connection.refreshTokenEnc, key));
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
      await this.markNeedsReconnect(connection.id);
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
