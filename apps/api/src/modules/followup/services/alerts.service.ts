import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import { ActivityMetricsService } from '../../bookings/services/activity-metrics.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { evaluateClientAlerts, initials, shownPlan, toPerformanceInput } from '../domain/alert-rules.js';
import { checkinAlertTypes, checkinPeriodKey, type CheckinAlertType } from '../domain/checkin-rules.js';
import {
  ALERT_TYPES, type AlertCandidate, type AlertCountsDto, type AlertDto, type AlertStatus, type AlertType,
} from '../models/alert.model.js';
import type { AnsweredCheckin } from '../models/checkin.model.js';
import { InactivityService } from './inactivity.service.js';

interface AlertRow {
  id: string;
  userId: string;
  userName: string;
  type: AlertType;
  status: AlertStatus;
  context: Record<string, unknown>;
  contactsCount: number;
  createdAt: Date;
}

interface CheckinDetailRow { id: string; painDetail: string | null; goalsDetail: string | null }

type NewAlert = AlertCandidate & { userId: string };

const LIST_LIMIT = 200;
const CHECKIN_ALERT_TYPES: AlertType[] = ['checkin_pain', 'checkin_goals'];

const ALERT_SELECT = `
  SELECT a.id, a.user_id AS "userId", u.name AS "userName", a.type, a.status, a.context, a.created_at AS "createdAt",
    (SELECT count(*)::int FROM followup_contacts c WHERE c.alert_id = a.id) AS "contactsCount"
  FROM followup_alerts a
  JOIN users u ON u.id = a.user_id`;

const zeroCounts = (): Record<AlertType, number> =>
  Object.fromEntries(ALERT_TYPES.map((type) => [type, 0])) as Record<AlertType, number>;

const groupByUser = (subs: SubscriptionModel[]): Map<string, SubscriptionModel[]> => {
  const byUser = new Map<string, SubscriptionModel[]>();
  for (const sub of subs) byUser.set(sub.userId, [...(byUser.get(sub.userId) ?? []), sub]);
  return byUser;
};

const roundTo1 = (value: number): number => Math.round(value * 10) / 10;

const checkinIdOf = (row: AlertRow): string | null =>
  CHECKIN_ALERT_TYPES.includes(row.type) && typeof row.context.checkinId === 'string' ? row.context.checkinId : null;

@Injectable()
export class AlertsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly metrics: ActivityMetricsService,
    private readonly inactivity: InactivityService,
  ) {}

  // R12: loads every client's data in batch and inserts only alerts whose key is new.
  async detectAlerts(today: string): Promise<Record<AlertType, number>> {
    const clients = await this.users.listClients();
    const ids = clients.map((client) => client.id);
    const [settings, pauses, subs, metrics] = await Promise.all([
      this.settings.getAll(),
      this.inactivity.getActivePauses(ids),
      this.subscriptions.listPerformanceByUsers(ids),
      this.metrics.getMetrics(ids, today),
    ]);
    const subsByUser = groupByUser(subs);

    const alerts = ids.flatMap((userId): NewAlert[] => {
      const pause = pauses.get(userId);
      const userMetrics = metrics.get(userId);
      const candidates = evaluateClientAlerts({
        today,
        settings,
        paused: pause ? { reasonId: pause.id, recontactOn: pause.recontactOn } : null,
        performance: toPerformanceInput(subsByUser.get(userId) ?? [], today),
        metrics: {
          lastAttendanceOn: userMetrics?.lastAttendanceOn ?? null,
          recentFrequency: userMetrics?.recentFrequency ?? 0,
          baselineFrequency: userMetrics?.baselineFrequency ?? 0,
        },
      });
      return candidates.map((candidate) => ({ ...candidate, userId }));
    });
    return this.insertNew(alerts);
  }

  async counts(): Promise<AlertCountsDto> {
    const rows: { type: AlertType; count: number }[] = await this.dataSource.query(
      `SELECT type, count(*)::int AS count FROM followup_alerts WHERE status = 'open' GROUP BY type`,
    );
    const counts = zeroCounts();
    for (const row of rows) counts[row.type] = row.count;
    return { ...counts, total: rows.reduce((sum, row) => sum + row.count, 0) };
  }

  async list(q: { type?: AlertType; status: AlertStatus }): Promise<AlertDto[]> {
    const rows: AlertRow[] = await this.dataSource.query(
      `${ALERT_SELECT} WHERE a.status = $1 AND ($2::text IS NULL OR a.type = $2)
       ORDER BY a.created_at DESC, a.id LIMIT ${LIST_LIMIT}`,
      [q.status, q.type ?? null],
    );
    return this.toDtos(rows);
  }

  async handle(alertId: string, staffId: string): Promise<AlertDto> {
    const handled: { id: string }[] = await this.dataSource.query(
      `WITH handled AS (
         UPDATE followup_alerts SET status = 'handled', handled_at = now(), handled_by = $2, updated_at = now()
         WHERE id = $1 AND status = 'open' RETURNING id
       ) SELECT id FROM handled`,
      [alertId, staffId],
    );
    const rows: AlertRow[] = await this.dataSource.query(`${ALERT_SELECT} WHERE a.id = $1`, [alertId]);
    if (rows.length === 0) throw new AppError('ALERT_NOT_FOUND');
    if (handled.length === 0) throw new AppError('ALERT_ALREADY_HANDLED');
    const [dto] = await this.toDtos(rows);
    return dto;
  }

  // R12: alerts of an answered check-in, in the caller's transaction. Returns the main alert (pain first).
  async createCheckinAlerts(manager: EntityManager, checkin: AnsweredCheckin): Promise<string | null> {
    const types = checkinAlertTypes(checkin);
    if (types.length === 0) return null;
    const periodKey = checkinPeriodKey(checkin.id);
    await manager.query(
      `INSERT INTO followup_alerts (user_id, type, period_key, context)
       SELECT $1, type, $2, $3::jsonb FROM unnest($4::text[]) AS type
       ON CONFLICT (user_id, type, period_key) DO NOTHING`,
      [checkin.userId, periodKey, JSON.stringify({ checkinId: checkin.id }), types],
    );
    const [main]: { id: string }[] = await manager.query(
      `SELECT id FROM followup_alerts WHERE user_id = $1 AND type = $2 AND period_key = $3`,
      [checkin.userId, types[0], periodKey],
    );
    return main?.id ?? null;
  }

  // Marks a check-in alert as handled, in the caller's transaction (no-op if missing or already handled).
  async handleCheckinAlert(
    manager: EntityManager,
    checkin: { id: string; userId: string },
    type: CheckinAlertType,
    staffId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE followup_alerts SET status = 'handled', handled_at = now(), handled_by = $4, updated_at = now()
       WHERE user_id = $1 AND type = $2 AND period_key = $3 AND status = 'open'`,
      [checkin.userId, type, checkinPeriodKey(checkin.id), staffId],
    );
  }

  private async insertNew(alerts: NewAlert[]): Promise<Record<AlertType, number>> {
    const created = zeroCounts();
    if (alerts.length === 0) return created;
    const rows: { type: AlertType; count: number }[] = await this.dataSource.query(
      `WITH inserted AS (
         INSERT INTO followup_alerts (user_id, type, period_key, context)
         SELECT x.user_id, x.type, x.period_key, x.context
         FROM jsonb_to_recordset($1::jsonb) AS x(user_id uuid, type text, period_key text, context jsonb)
         ON CONFLICT (user_id, type, period_key) DO NOTHING
         RETURNING type
       ) SELECT type, count(*)::int AS count FROM inserted GROUP BY type`,
      [JSON.stringify(alerts.map((a) => ({ user_id: a.userId, type: a.type, period_key: a.periodKey, context: a.context })))],
    );
    for (const row of rows) created[row.type] = row.count;
    return created;
  }

  private async toDtos(rows: AlertRow[]): Promise<AlertDto[]> {
    if (rows.length === 0) return [];
    const today = businessToday();
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const checkinIds = rows.map(checkinIdOf).filter((id): id is string => id !== null);
    const [subs, metrics, pauses, checkins] = await Promise.all([
      this.subscriptions.listPerformanceByUsers(userIds),
      this.metrics.getMetrics(userIds, today),
      this.inactivity.getActivePauses(userIds),
      this.checkinDetails(checkinIds),
    ]);
    const subsByUser = groupByUser(subs);

    return rows.map((row) => {
      const plan = shownPlan(subsByUser.get(row.userId) ?? [], today);
      const userMetrics = metrics.get(row.userId);
      const pause = pauses.get(row.userId);
      const checkinId = checkinIdOf(row);
      const usual = userMetrics?.usualFrequencyPerWeek ?? 0;
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        client: { id: row.userId, name: row.userName, initials: initials(row.userName) },
        planName: plan?.planName ?? null,
        endsOn: plan?.endsOn ?? null,
        lastAttendanceOn: userMetrics?.lastAttendanceOn ?? null,
        frequencyPerWeek: userMetrics?.frequencyPerWeek ?? 0,
        usualFrequencyPerWeek: usual > 0 ? roundTo1(usual) : null,
        contactsCount: row.contactsCount,
        pause: pause ? { reason: pause.reason, since: pause.startedAt, recontactOn: pause.recontactOn } : null,
        checkin: checkinId ? (checkins.get(checkinId) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  private async checkinDetails(ids: string[]): Promise<Map<string, CheckinDetailRow>> {
    if (ids.length === 0) return new Map();
    const rows: CheckinDetailRow[] = await this.dataSource.query(
      `SELECT id, pain_detail AS "painDetail", goals_detail AS "goalsDetail" FROM checkins WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row]));
  }
}
