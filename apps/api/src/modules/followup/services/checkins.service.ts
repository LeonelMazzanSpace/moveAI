import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import { appConfig } from '../../../config/app.config.js';
import { ActivityMetricsService } from '../../bookings/services/activity-metrics.service.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { shownPlan } from '../domain/alert-rules.js';
import { computeCheckinFlag } from '../domain/checkin-rules.js';
import type { AnswerCheckinDto } from '../dto/answer-checkin.dto.js';
import { textOrNull } from '../dto/followup-fields.js';
import type { AlertStatus } from '../models/alert.model.js';
import type {
  CheckinFlag, CheckinResponseDto, CheckinStatsDto, Feeling, GoalsChange, PainLevel, PendingCheckinDto,
} from '../models/checkin.model.js';
import { AlertsService } from './alerts.service.js';

interface ResponseRow {
  id: string;
  userId: string;
  userName: string;
  period: string;
  feeling: Feeling;
  pain: PainLevel;
  painDetail: string | null;
  goals: GoalsChange;
  goalsDetail: string | null;
  flag: CheckinFlag;
  respondedAt: Date;
  alertId: string | null;
  alertStatus: AlertStatus | null;
}

// The alert that follows a check-in's flag (pain → checkin_pain, goals → checkin_goals). `responses` reports its status and
// `stats` counts it as needing intervention while it is open, so both always agree.
const FLAG_ALERT_MATCH = `a.user_id = c.user_id AND a.period_key = 'checkin:' || c.id
    AND a.type = CASE c.flag WHEN 'pain' THEN 'checkin_pain' WHEN 'goals' THEN 'checkin_goals' END`;

const RESPONSE_SELECT = `
  SELECT c.id, c.user_id AS "userId", u.name AS "userName", c.period, c.feeling, c.pain, c.pain_detail AS "painDetail",
    c.goals, c.goals_detail AS "goalsDetail", c.flag, c.responded_at AS "respondedAt", a.id AS "alertId", a.status AS "alertStatus"
  FROM checkins c
  JOIN users u ON u.id = c.user_id
  LEFT JOIN followup_alerts a ON ${FLAG_ALERT_MATCH}
  WHERE c.status = 'answered'`;

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

@Injectable()
export class CheckinsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly alerts: AlertsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly metrics: ActivityMetricsService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  // R13: one check-in per client and period; `sent` counts the new rows only. Emails go out after the insert commits, to
  // every check-in of the period still without an invite, so a run that stopped before its emails is completed by the next.
  async send(period: string): Promise<{ sent: number; period: string }> {
    const sent = await this.insertEligible(period);
    await this.emailMissingInvites(period);
    return { sent, period };
  }

  async pendingFor(userId: string): Promise<PendingCheckinDto | null> {
    const [row]: { id: string; period: string; name: string }[] = await this.dataSource.query(
      `SELECT c.id, c.period, u.name FROM checkins c JOIN users u ON u.id = c.user_id
       WHERE c.user_id = $1 AND c.status = 'sent' ORDER BY c.sent_at DESC, c.period DESC LIMIT 1`,
      [userId],
    );
    return row ? { id: row.id, period: row.period, firstName: firstName(row.name) } : null;
  }

  // R13: another client's check-in answers CHECKIN_NOT_FOUND, like a missing one.
  async answer(userId: string, checkinId: string, dto: AnswerCheckinDto): Promise<{ flag: CheckinFlag }> {
    const flag = computeCheckinFlag(dto);
    await this.dataSource.transaction(async (manager) => {
      const [checkin]: { userId: string; status: string }[] = await manager.query(
        `SELECT user_id AS "userId", status FROM checkins WHERE id = $1 FOR UPDATE`,
        [checkinId],
      );
      if (!checkin || checkin.userId !== userId) throw new AppError('CHECKIN_NOT_FOUND');
      if (checkin.status === 'answered') throw new AppError('CHECKIN_ALREADY_ANSWERED');
      await manager.query(
        `UPDATE checkins SET status = 'answered', responded_at = now(), feeling = $2, pain = $3, pain_detail = $4, goals = $5,
           goals_detail = $6, flag = $7, updated_at = now()
         WHERE id = $1`,
        [checkinId, dto.feeling, dto.pain, textOrNull(dto.painDetail), dto.goals, textOrNull(dto.goalsDetail), flag],
      );
      await this.alerts.createCheckinAlerts(manager, { id: checkinId, userId, pain: dto.pain, goals: dto.goals });
    });
    return { flag };
  }

  async stats(period: string): Promise<CheckinStatsDto> {
    const [row]: Omit<CheckinStatsDto, 'period'>[] = await this.dataSource.query(
      `SELECT count(*)::int AS sent,
         count(*) FILTER (WHERE c.status = 'answered')::int AS answered,
         count(*) FILTER (WHERE c.status = 'answered' AND EXISTS (
           SELECT 1 FROM followup_alerts a WHERE ${FLAG_ALERT_MATCH} AND a.status = 'open'
         ))::int AS "needsIntervention"
       FROM checkins c WHERE c.period = $1`,
      [period],
    );
    return { period, ...row };
  }

  async responses(q: { period: string; flag?: CheckinFlag }): Promise<CheckinResponseDto[]> {
    const rows: ResponseRow[] = await this.dataSource.query(
      `${RESPONSE_SELECT} AND c.period = $1 AND ($2::text IS NULL OR c.flag = $2) ORDER BY c.responded_at DESC, c.id`,
      [q.period, q.flag ?? null],
    );
    return this.toResponses(rows);
  }

  // Enables Rehab follow-up and handles the pain alert in one transaction; emails the client after the commit.
  async referRehab(checkinId: string, staffId: string): Promise<CheckinResponseDto> {
    const userId = await this.dataSource.transaction(async (manager) => {
      const [checkin]: { userId: string }[] = await manager.query(
        `SELECT user_id AS "userId" FROM checkins WHERE id = $1 AND status = 'answered' FOR UPDATE`,
        [checkinId],
      );
      if (!checkin) throw new AppError('CHECKIN_NOT_FOUND');
      await this.users.setRehabFollowupEnabled(checkin.userId, true, manager);
      await this.alerts.handleCheckinAlert(manager, { id: checkinId, userId: checkin.userId }, 'checkin_pain', staffId);
      return checkin.userId;
    });
    await this.sendRehabReferral(userId, checkinId);
    const [response] = await this.toResponses(await this.dataSource.query(`${RESPONSE_SELECT} AND c.id = $1`, [checkinId]));
    return response;
  }

  async lastAnsweredFor(userId: string): Promise<{ period: string; respondedAt: Date } | null> {
    const [row]: { period: string; respondedAt: Date }[] = await this.dataSource.query(
      `SELECT period, responded_at AS "respondedAt" FROM checkins
       WHERE user_id = $1 AND status = 'answered' ORDER BY responded_at DESC LIMIT 1`,
      [userId],
    );
    return row ?? null;
  }

  private async insertEligible(period: string): Promise<number> {
    const rows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO checkins (user_id, period)
       SELECT u.id, $1 FROM users u
       WHERE u.role = 'client' AND u.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s.user_id = u.id AND s.service = 'performance' AND s.deleted_at IS NULL AND s.starts_on <= $2 AND s.ends_on >= $2
         )
         AND NOT EXISTS (SELECT 1 FROM inactivity_reasons r WHERE r.user_id = u.id AND r.ended_at IS NULL)
       ON CONFLICT (user_id, period) DO NOTHING
       RETURNING id`,
      [period, businessToday()],
    );
    return rows.length;
  }

  // The `checkin:<id>` idempotency key keeps concurrent or repeated runs to one invite. Paused clients get none (D11).
  private async emailMissingInvites(period: string): Promise<void> {
    const rows: { id: string; userId: string }[] = await this.dataSource.query(
      `SELECT c.id, c.user_id AS "userId" FROM checkins c
       JOIN users u ON u.id = c.user_id
       WHERE c.period = $1 AND c.status = 'sent' AND u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM inactivity_reasons r WHERE r.user_id = c.user_id AND r.ended_at IS NULL)
         AND NOT EXISTS (SELECT 1 FROM email_logs l WHERE l.idempotency_key = 'checkin:' || c.id)`,
      [period],
    );
    const users = new Map((await this.users.findByIds(rows.map((row) => row.userId))).map((user) => [user.id, user]));
    for (const row of rows) {
      const user = users.get(row.userId);
      if (!user) continue;
      await this.notifications.send({
        template: 'checkin-invite',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `checkin:${row.id}`,
        params: { name: user.name, url: `${this.app.webUrl}/check-in` },
      });
    }
  }

  private async sendRehabReferral(userId: string, checkinId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) return;
    await this.notifications.send({
      template: 'rehab-referral',
      to: { email: user.email, name: user.name },
      userId: user.id,
      idempotencyKey: `rehab-referral:${checkinId}`,
      params: { name: user.name, url: `${this.app.webUrl}/reservar/fisioterapia` },
    });
  }

  private async toResponses(rows: ResponseRow[]): Promise<CheckinResponseDto[]> {
    if (rows.length === 0) return [];
    const today = businessToday();
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [subs, metrics] = await Promise.all([
      this.subscriptions.listPerformanceByUsers(userIds),
      this.metrics.getMetrics(userIds, today),
    ]);
    const subsOf = (userId: string): SubscriptionModel[] => subs.filter((sub) => sub.userId === userId);
    return rows.map(({ userId, userName, respondedAt, ...row }) => ({
      ...row,
      client: { id: userId, name: userName },
      respondedAt: respondedAt.toISOString(),
      frequencyPerWeek: metrics.get(userId)?.frequencyPerWeek ?? 0,
      planName: shownPlan(subsOf(userId), today)?.planName ?? null,
    }));
  }
}
