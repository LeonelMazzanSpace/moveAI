import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import { UsersService } from '../../users/services/users.service.js';
import { textOrNull } from '../dto/followup-fields.js';
import type { StartInactivityDto } from '../dto/start-inactivity.dto.js';
import type { AlertType } from '../models/alert.model.js';
import type { InactivityReasonCode, InactivityReasonDto } from '../models/inactivity.model.js';

interface ReasonRow {
  id: string;
  userId: string;
  reason: InactivityReasonCode;
  note: string | null;
  recontactOn: string | null;
  startedAt: Date;
  endedAt: Date | null;
  createdByName: string;
}

// Opening a pause closes these alerts (D11: a paused client gets no inactivity, frequency or expiry alerts).
const HANDLED_ON_PAUSE: AlertType[] = ['no_attendance', 'prolonged_inactivity', 'frequency_drop', 'expiring', 'expired'];

const REASON_SELECT = `
  SELECT r.id, r.user_id AS "userId", r.reason, r.note, r.recontact_on AS "recontactOn", r.started_at AS "startedAt",
    r.ended_at AS "endedAt", c.name AS "createdByName"
  FROM inactivity_reasons r
  JOIN users c ON c.id = r.created_by`;

const toDto = ({ userId: _userId, ...row }: ReasonRow): InactivityReasonDto => ({
  ...row,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
});

const isActivePauseDuplicate = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; constraint?: string };
  return driverError.code === '23505' && driverError.constraint === 'UQ_inactivity_reasons_active_user';
};

@Injectable()
export class InactivityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

  async start(userId: string, staffId: string, dto: StartInactivityDto): Promise<InactivityReasonDto> {
    if (dto.recontactOn !== undefined && dto.recontactOn < businessToday()) {
      throw new AppError('VALIDATION_FAILED', [{ field: 'recontactOn', messages: ['recontactOn must be today or later'] }]);
    }
    await this.assertClient(userId);
    const id = await this.dataSource.transaction(async (manager) => {
      const reasonId = await this.insertReason(manager, userId, staffId, dto);
      await manager.query(
        `UPDATE followup_alerts SET status = 'handled', handled_at = now(), handled_by = $2, updated_at = now()
         WHERE user_id = $1 AND status = 'open' AND type = ANY($3::text[])`,
        [userId, staffId, HANDLED_ON_PAUSE],
      );
      return reasonId;
    });
    return this.getById(id);
  }

  async end(userId: string): Promise<InactivityReasonDto> {
    await this.assertClient(userId);
    const rows: { id: string }[] = await this.dataSource.query(
      `WITH ended AS (
         UPDATE inactivity_reasons SET ended_at = now(), updated_at = now() WHERE user_id = $1 AND ended_at IS NULL RETURNING id
       ) SELECT id FROM ended`,
      [userId],
    );
    if (rows.length === 0) throw new AppError('NO_ACTIVE_PAUSE');
    return this.getById(rows[0].id);
  }

  async getActivePauses(userIds: string[]): Promise<Map<string, InactivityReasonDto>> {
    if (userIds.length === 0) return new Map();
    const rows: ReasonRow[] = await this.dataSource.query(
      `${REASON_SELECT} WHERE r.user_id = ANY($1::uuid[]) AND r.ended_at IS NULL`,
      [userIds],
    );
    return new Map(rows.map((row) => [row.userId, toDto(row)]));
  }

  async listForUser(userId: string): Promise<InactivityReasonDto[]> {
    const rows: ReasonRow[] = await this.dataSource.query(
      `${REASON_SELECT} WHERE r.user_id = $1 ORDER BY r.started_at DESC, r.id`,
      [userId],
    );
    return rows.map(toDto);
  }

  private async insertReason(manager: EntityManager, userId: string, staffId: string, dto: StartInactivityDto): Promise<string> {
    try {
      const [row]: { id: string }[] = await manager.query(
        `INSERT INTO inactivity_reasons (user_id, reason, note, recontact_on, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, dto.reason, textOrNull(dto.note), dto.recontactOn ?? null, staffId],
      );
      return row.id;
    } catch (error) {
      if (isActivePauseDuplicate(error)) throw new AppError('PAUSE_ALREADY_ACTIVE');
      throw error;
    }
  }

  private async getById(id: string): Promise<InactivityReasonDto> {
    const [row]: ReasonRow[] = await this.dataSource.query(`${REASON_SELECT} WHERE r.id = $1`, [id]);
    return toDto(row);
  }

  private async assertClient(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'client') throw new AppError('CLIENT_NOT_FOUND');
  }
}
