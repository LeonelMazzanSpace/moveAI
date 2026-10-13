import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import {
  computeActivationPeriod, performanceSummary, toPackDto, toSubscriptionDto,
} from '../domain/vigencia.js';
import type {
  MySubscriptionsDto, PlanSnapshot, SubscriptionModel, SubscriptionServiceKind,
} from '../models/subscription.model.js';

const SERVICE_BY_KIND: Partial<Record<PlanSnapshot['kind'], SubscriptionServiceKind>> = {
  period_plan: 'performance',
  session_pack: 'recovery',
};

// Raw SQL keeps the locks explicit; `plans` is joined only to read the plan name (soft-deleted plans included).
const MODEL_COLUMNS = `s.id, s.user_id AS "userId", s.plan_id AS "planId", p.name AS "planName", s.service,
  s.starts_on AS "startsOn", s.ends_on AS "endsOn", s.sessions_total AS "sessionsTotal",
  s.sessions_used AS "sessionsUsed", s.purchase_id AS "purchaseId", s.created_at AS "createdAt"`;
const FROM_SUBSCRIPTIONS = `FROM subscriptions s JOIN plans p ON p.id = s.plan_id`;

export interface ActivateFromPurchaseInput { purchaseId: string; userId: string; plan: PlanSnapshot; today: string }

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  // R3, idempotent by `purchase_id`.
  async activateFromPurchase(manager: EntityManager, input: ActivateFromPurchaseInput): Promise<SubscriptionModel> {
    const service = SERVICE_BY_KIND[input.plan.kind];
    if (!service) throw new AppError('PLAN_KIND_INVALID');

    // Serializes activations per user: the row locks below cannot cover a user without subscriptions yet.
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('subscriptions:' || $1))`, [input.userId]);
    const existing = await this.findByPurchase(manager, input.purchaseId);
    if (existing) return existing;

    const latestEndsOn = service === 'performance' ? await this.lockLatestPerformanceEnd(manager, input.userId) : null;
    const period = computeActivationPeriod(input.plan, latestEndsOn, input.today);
    await manager.query(
      `INSERT INTO subscriptions (user_id, plan_id, purchase_id, service, starts_on, ends_on, sessions_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (purchase_id) WHERE purchase_id IS NOT NULL DO NOTHING`,
      [input.userId, input.plan.id, input.purchaseId, service, period.startsOn, period.endsOn, period.sessionsTotal],
    );
    const created = await this.findByPurchase(manager, input.purchaseId);
    if (!created) throw new AppError('INTERNAL_ERROR');
    return created;
  }

  // R2.
  async findCoveringPerformance(manager: EntityManager, userId: string, date: string): Promise<SubscriptionModel | null> {
    const rows: SubscriptionModel[] = await manager.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_SUBSCRIPTIONS}
       WHERE s.user_id = $1 AND s.service = 'performance' AND s.starts_on <= $2 AND s.ends_on >= $2 AND s.deleted_at IS NULL
       ORDER BY s.ends_on DESC LIMIT 1`,
      [userId, date],
    );
    return rows[0] ?? null;
  }

  // R5. No SKIP LOCKED: a waiting transaction re-checks the WHERE once the lock is released, so an
  // exhausted pack is skipped and the next one (if any) is taken.
  async consumePackSession(manager: EntityManager, userId: string, date: string): Promise<SubscriptionModel | null> {
    const locked: { id: string }[] = await manager.query(
      `SELECT id FROM subscriptions
       WHERE user_id = $1 AND service = 'recovery' AND starts_on <= $2 AND ends_on >= $2
         AND sessions_used < sessions_total AND deleted_at IS NULL
       ORDER BY ends_on, created_at LIMIT 1 FOR UPDATE`,
      [userId, date],
    );
    if (locked.length === 0) return null;
    const rows: SubscriptionModel[] = await manager.query(
      `WITH updated AS (
         UPDATE subscriptions SET sessions_used = sessions_used + 1, updated_at = now()
         WHERE id = $1 AND sessions_used < sessions_total RETURNING *
       ) SELECT ${MODEL_COLUMNS} FROM updated s JOIN plans p ON p.id = s.plan_id`,
      [locked[0].id],
    );
    return rows[0] ?? null;
  }

  async releasePackSession(manager: EntityManager, subscriptionId: string): Promise<void> {
    await manager.query(
      `UPDATE subscriptions SET sessions_used = sessions_used - 1, updated_at = now()
       WHERE id = $1 AND service = 'recovery' AND sessions_used > 0`,
      [subscriptionId],
    );
  }

  async getMySubscriptions(userId: string, today: string): Promise<MySubscriptionsDto> {
    const [performance, packs, expiringSoonDays] = await Promise.all([
      this.listPerformanceByUsers([userId]),
      this.listActivePacksByUsers([userId], today),
      this.settings.get('expiringSoonDays'),
    ]);
    const { current, upcoming, latest } = performanceSummary(performance, today);
    const shown = current ?? upcoming ?? latest;
    const next = upcoming && upcoming !== shown ? upcoming : null;
    return {
      performance: shown ? toSubscriptionDto(shown, today, expiringSoonDays) : null,
      upcomingPerformance: next ? toSubscriptionDto(next, today, expiringSoonDays) : null,
      recoveryPacks: packs.map(toPackDto),
    };
  }

  async listPerformanceByUsers(userIds: string[]): Promise<SubscriptionModel[]> {
    if (userIds.length === 0) return [];
    return this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_SUBSCRIPTIONS}
       WHERE s.user_id = ANY($1::uuid[]) AND s.service = 'performance' AND s.deleted_at IS NULL
       ORDER BY s.user_id, s.starts_on, s.created_at`,
      [userIds],
    );
  }

  // Packs whose period covers `today`, including exhausted ones (the UI shows their balance).
  async listActivePacksByUsers(userIds: string[], today: string): Promise<SubscriptionModel[]> {
    if (userIds.length === 0) return [];
    return this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_SUBSCRIPTIONS}
       WHERE s.user_id = ANY($1::uuid[]) AND s.service = 'recovery' AND s.starts_on <= $2 AND s.ends_on >= $2
         AND s.deleted_at IS NULL
       ORDER BY s.user_id, s.ends_on, s.created_at`,
      [userIds, today],
    );
  }

  async findById(id: string): Promise<SubscriptionModel | null> {
    const rows: SubscriptionModel[] = await this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_SUBSCRIPTIONS} WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async findByPurchase(manager: EntityManager, purchaseId: string): Promise<SubscriptionModel | null> {
    const rows: SubscriptionModel[] = await manager.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_SUBSCRIPTIONS} WHERE s.purchase_id = $1`,
      [purchaseId],
    );
    return rows[0] ?? null;
  }

  private async lockLatestPerformanceEnd(manager: EntityManager, userId: string): Promise<string | null> {
    const rows: { endsOn: string }[] = await manager.query(
      `SELECT ends_on AS "endsOn" FROM subscriptions
       WHERE user_id = $1 AND service = 'performance' AND deleted_at IS NULL
       ORDER BY ends_on DESC FOR UPDATE`,
      [userId],
    );
    return rows[0]?.endsOn ?? null;
  }
}
