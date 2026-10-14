import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import { appConfig } from '../../../config/app.config.js';
import { mercadoPagoConfig } from '../../../config/mercado-pago.config.js';
import { displayDate } from '../../bookings/domain/booking-rules.js';
import type { PlanModel } from '../../catalog/models/plan.model.js';
import { CatalogService } from '../../catalog/services/catalog.service.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import type { PlanSnapshot } from '../../subscriptions/models/subscription.model.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { firstChargeDate, frequencyOf, isPendingExpired, nextChargeAfter } from '../domain/auto-debit-schedule.js';
import type { AutoDebitCancelReason, AutoDebitService } from '../entities/auto-debit.entity.js';
import type { AutoDebitCheckoutDto, AutoDebitDto, AutoDebitModel, AutoDebitStatusDto } from '../models/auto-debit.model.js';
import type { ProviderPreapproval } from '../models/provider-preapproval.model.js';
import { MercadoPagoService } from './mercado-pago.service.js';

const UNIQUE_VIOLATION = '23505';

const MODEL_COLUMNS = `ad.id, ad.user_id AS "userId", ad.external_reference AS "externalReference",
  ad.mp_preapproval_id AS "mpPreapprovalId", ad.service, ad.status, ad.amount, ad.frequency,
  ad.frequency_type AS "frequencyType", ad.next_charge_date AS "nextChargeDate", ad.created_at AS "createdAt",
  ad.cancelled_at AS "cancelledAt", ad.cancel_reason AS "cancelReason",
  pl.id AS "planId", pl.name AS "planName", pl.slug AS "planSlug"`;
const FROM_AUTO_DEBITS = `FROM auto_debits ad JOIN plans pl ON pl.id = ad.plan_id`;

// A debit locked for a charge, with the plan fields its activation needs.
export interface LockedAutoDebit { debit: AutoDebitModel; plan: PlanSnapshot }

type LockedAutoDebitRow = AutoDebitModel & {
  planKind: PlanSnapshot['kind'];
  planService: PlanSnapshot['service'];
  sessionsIncluded: number | null;
};

const toDto = (debit: AutoDebitModel): AutoDebitDto => ({
  id: debit.id,
  planId: debit.planId,
  planName: debit.planName,
  planSlug: debit.planSlug,
  service: debit.service,
  status: debit.status,
  amount: debit.amount,
  frequency: debit.frequency,
  frequencyType: debit.frequencyType,
  nextChargeDate: debit.nextChargeDate,
  createdAt: debit.createdAt.toISOString(),
  cancelledAt: debit.cancelledAt?.toISOString() ?? null,
  cancelReason: debit.cancelReason,
});

const toStatusDto = (debit: AutoDebitModel): AutoDebitStatusDto => ({
  externalReference: debit.externalReference,
  status: debit.status,
  planName: debit.planName,
  planSlug: debit.planSlug,
  service: debit.service,
  amount: debit.amount,
  nextChargeDate: debit.nextChargeDate,
});

// The plan of a charge is the debited one, with the period fixed at checkout (D97: the debit keeps its terms).
const toLocked = (row: LockedAutoDebitRow): LockedAutoDebit => {
  const { planKind, planService, sessionsIncluded, ...debit } = row;
  return {
    debit,
    plan: {
      id: debit.planId,
      name: debit.planName,
      service: planService,
      kind: planKind,
      periodMonths: debit.frequencyType === 'months' ? debit.frequency : null,
      periodDays: debit.frequencyType === 'days' ? debit.frequency : null,
      sessionsIncluded,
    },
  };
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION;

// D96/D97: Mercado Pago subscriptions (preapproval) for the plans staff mark with `autoDebitEnabled`. The charges
// themselves are applied by `PaymentsService.applyAutoDebitCharge`; this service owns the debit and its state.
@Injectable()
export class AutoDebitsService {
  private readonly logger = new Logger(AutoDebitsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogService,
    private readonly subscriptions: SubscriptionsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly mercadoPago: MercadoPagoService,
    @Inject(mercadoPagoConfig.KEY) private readonly config: ConfigType<typeof mercadoPagoConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  // One active debit per client and service (D97): an authorized one blocks a new checkout, a pending one is replaced.
  // Mercado Pago is called after the commit; if it fails the new debit is closed before answering.
  async checkout(userId: string, planSlug: string): Promise<AutoDebitCheckoutDto> {
    const plan = await this.catalog.findActiveBySlug(planSlug);
    if (!plan.autoDebitEnabled) throw new AppError('AUTO_DEBIT_NOT_ALLOWED');
    const frequency = frequencyOf(plan);
    // period_plan and session_pack (the only kinds frequencyOf accepts) are Performance or Recovery by the plan CHECKs.
    const service = plan.service as AutoDebitService;
    const startDate = firstChargeDate(service, await this.latestPerformanceEnd(userId), businessToday());

    const { created, replaced } = await this.dataSource
      .transaction(async (manager) => {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtext('auto-debits:' || $1 || ':' || $2))`, [userId, service]);
        const active: AutoDebitModel[] = await manager.query(
          `SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS}
           WHERE ad.user_id = $1 AND ad.service = $2 AND ad.status IN ('pending','authorized') FOR UPDATE OF ad`,
          [userId, service],
        );
        if (active.some((debit) => debit.status === 'authorized')) throw new AppError('AUTO_DEBIT_ACTIVE');
        for (const debit of active) await this.markCancelled(manager, debit.id, 'client');
        const [row]: { id: string; externalReference: string }[] = await manager.query(
          `INSERT INTO auto_debits (user_id, plan_id, service, amount, frequency, frequency_type, next_charge_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, external_reference AS "externalReference"`,
          [userId, plan.id, service, plan.price, frequency.frequency, frequency.frequencyType, startDate],
        );
        return { created: row, replaced: active };
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new AppError('AUTO_DEBIT_ACTIVE');
        throw error;
      });

    for (const debit of replaced) await this.cancelReplacedAtProvider(debit);
    const initPoint = await this.startPreapproval(created, plan, userId, frequency, startDate);
    return { externalReference: created.externalReference, initPoint };
  }

  async getStatus(userId: string, externalReference: string): Promise<AutoDebitStatusDto> {
    const debit = isUUID(externalReference) ? await this.findByExternalReference(externalReference) : null;
    if (!debit || debit.userId !== userId) throw new AppError('AUTO_DEBIT_NOT_FOUND');
    return toStatusDto(debit);
  }

  async getStatusByReference(externalReference: string): Promise<AutoDebitStatusDto> {
    const debit = await this.findByExternalReference(externalReference);
    if (!debit) throw new AppError('AUTO_DEBIT_NOT_FOUND');
    return toStatusDto(debit);
  }

  // Every debit of the client, latest first.
  async listForUser(userId: string): Promise<AutoDebitDto[]> {
    const rows: AutoDebitModel[] = await this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS} WHERE ad.user_id = $1 ORDER BY ad.created_at DESC, ad.id DESC`,
      [userId],
    );
    return rows.map(toDto);
  }

  // D97: cancelling stops the charges; what was already paid stays valid. Mercado Pago is cancelled first, so a debit
  // is never closed in MOVE while Mercado Pago keeps charging. Cancelling twice changes nothing (one email).
  async cancel(input: { userId: string; id: string; by: Extract<AutoDebitCancelReason, 'client' | 'staff'> }): Promise<AutoDebitDto> {
    const debit = isUUID(input.id) ? await this.findById(input.id) : null;
    if (!debit || debit.userId !== input.userId) throw new AppError('AUTO_DEBIT_NOT_FOUND');
    if (debit.status !== 'cancelled') {
      if (debit.mpPreapprovalId && !this.config.simulatorEnabled) await this.cancelAtProvider(debit.mpPreapprovalId);
      if (await this.markCancelled(this.dataSource.manager, debit.id, input.by)) await this.sendCancelled(debit);
    }
    return toDto(await this.requireById(debit.id));
  }

  // Applies the state Mercado Pago reports. `paused` has no meaning in MOVE: the debit stays authorized (D97). A
  // cancellation made in Mercado Pago (by the client there or by Mercado Pago) is emailed like one made in MOVE.
  async refresh(preapproval: ProviderPreapproval): Promise<AutoDebitModel | null> {
    const debit =
      (await this.findByPreapprovalId(preapproval.id)) ??
      (isUUID(preapproval.externalReference) ? await this.findByExternalReference(preapproval.externalReference) : null);
    if (!debit) {
      this.logger.warn(`preapproval ${preapproval.id} ignored: unknown auto debit`);
      return null;
    }
    if (preapproval.status === 'paused') this.logger.warn(`auto debit ${debit.id} paused in Mercado Pago preapproval=${preapproval.id}`);
    if (preapproval.status === 'authorized' || preapproval.status === 'paused') {
      await this.dataSource.query(
        `UPDATE auto_debits SET status = 'authorized', next_charge_date = COALESCE($2, next_charge_date), updated_at = now()
         WHERE id = $1 AND status IN ('pending','authorized')`,
        [debit.id, preapproval.nextPaymentDate],
      );
    }
    if (preapproval.status === 'cancelled' && (await this.markCancelled(this.dataSource.manager, debit.id, 'provider'))) {
      await this.sendCancelled(debit);
    }
    return this.requireById(debit.id);
  }

  // Locks the debit row: charges of one debit apply one at a time (webhook, reconciliation and simulator).
  async lockForCharge(manager: EntityManager, id: string): Promise<LockedAutoDebit | null> {
    const [row]: LockedAutoDebitRow[] = await manager.query(
      `SELECT ${MODEL_COLUMNS}, pl.kind AS "planKind", pl.service AS "planService", pl.sessions_included AS "sessionsIncluded"
       ${FROM_AUTO_DEBITS} WHERE ad.id = $1 FOR UPDATE OF ad`,
      [id],
    );
    return row ? toLocked(row) : null;
  }

  // A charge proves the client authorized the debit, even if its notification has not arrived yet.
  async markAuthorized(manager: EntityManager, id: string): Promise<void> {
    await manager.query(`UPDATE auto_debits SET status = 'authorized', updated_at = now() WHERE id = $1 AND status = 'pending'`, [id]);
  }

  // Development simulator: Mercado Pago would move the next charge one period ahead.
  async advanceNextCharge(id: string): Promise<void> {
    const debit = await this.requireById(id);
    const next = nextChargeAfter(debit.nextChargeDate ?? businessToday(), debit);
    await this.dataSource.query(`UPDATE auto_debits SET next_charge_date = $2, updated_at = now() WHERE id = $1 AND status = 'authorized'`, [
      id,
      next,
    ]);
  }

  async hasAuthorized(userId: string, service: AutoDebitService): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM auto_debits WHERE user_id = $1 AND service = $2 AND status = 'authorized' LIMIT 1`,
      [userId, service],
    );
    return rows.length > 0;
  }

  async listUsersWithAuthorized(service: AutoDebitService): Promise<Set<string>> {
    const rows: { userId: string }[] = await this.dataSource.query(
      `SELECT DISTINCT user_id AS "userId" FROM auto_debits WHERE service = $1 AND status = 'authorized'`,
      [service],
    );
    return new Set(rows.map((row) => row.userId));
  }

  // Debits whose state and charges the reconciliation reads from Mercado Pago.
  async listToReconcile(): Promise<AutoDebitModel[]> {
    return this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS}
       WHERE ad.status IN ('pending','authorized') AND ad.mp_preapproval_id IS NOT NULL ORDER BY ad.created_at`,
    );
  }

  // A debit left pending for more than 24 h is cancelled in Mercado Pago and closed as `expired`, without email. If
  // Mercado Pago cannot cancel it, it is retried on the next run. Returns how many debits expired.
  async expirePending(now: Date): Promise<number> {
    const pending: AutoDebitModel[] = await this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS} WHERE ad.status = 'pending' ORDER BY ad.created_at`,
    );
    let expired = 0;
    for (const debit of pending.filter((row) => isPendingExpired(row.createdAt, now))) {
      try {
        if (debit.mpPreapprovalId && !this.config.simulatorEnabled) await this.cancelAtProvider(debit.mpPreapprovalId);
      } catch {
        this.logger.warn(`auto debit ${debit.id} not expired: Mercado Pago did not cancel it`);
        continue;
      }
      if (await this.markCancelled(this.dataSource.manager, debit.id, 'expired', 'pending')) expired += 1;
    }
    return expired;
  }

  async findByPreapprovalId(preapprovalId: string): Promise<AutoDebitModel | null> {
    const rows: AutoDebitModel[] = await this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS} WHERE ad.mp_preapproval_id = $1`,
      [preapprovalId],
    );
    return rows[0] ?? null;
  }

  async findByExternalReference(externalReference: string): Promise<AutoDebitModel | null> {
    const rows: AutoDebitModel[] = await this.dataSource.query(
      `SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS} WHERE ad.external_reference = $1`,
      [externalReference],
    );
    return rows[0] ?? null;
  }

  // A declined charge: Mercado Pago retries it by itself, so the client gets one email per charge. Never throws.
  async sendChargeFailed(debit: AutoDebitModel, authorizedPaymentId: string): Promise<void> {
    try {
      const user = await this.users.findById(debit.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'auto-debit-charge-failed',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `auto-debit-charge-failed:${authorizedPaymentId}`,
        params: { name: user.name, planName: debit.planName, manageUrl: `${this.app.webUrl}/perfil` },
      });
    } catch {
      this.logger.error(`auto-debit-charge-failed email failed auto debit=${debit.id}`);
    }
  }

  // D97: sent once per debit, after it closed; what it already paid stays valid. Never throws.
  private async sendCancelled(debit: AutoDebitModel): Promise<void> {
    try {
      const user = await this.users.findById(debit.userId);
      if (!user) return;
      const [{ paidUntil }]: { paidUntil: string | null }[] = await this.dataSource.query(
        `SELECT max(s.ends_on) AS "paidUntil" FROM subscriptions s JOIN purchases pu ON pu.id = s.purchase_id
         WHERE pu.auto_debit_id = $1 AND s.deleted_at IS NULL`,
        [debit.id],
      );
      await this.notifications.send({
        template: 'auto-debit-cancelled',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `auto-debit-cancelled:${debit.id}`,
        params: {
          name: user.name,
          planName: debit.planName,
          paidUntil: paidUntil ? displayDate(paidUntil) : null,
          manageUrl: `${this.app.webUrl}/perfil`,
        },
      });
    } catch {
      this.logger.error(`auto-debit-cancelled email failed auto debit=${debit.id}`);
    }
  }

  private async findById(id: string): Promise<AutoDebitModel | null> {
    const rows: AutoDebitModel[] = await this.dataSource.query(`SELECT ${MODEL_COLUMNS} ${FROM_AUTO_DEBITS} WHERE ad.id = $1`, [id]);
    return rows[0] ?? null;
  }

  private async requireById(id: string): Promise<AutoDebitModel> {
    const debit = await this.findById(id);
    if (!debit) throw new AppError('AUTO_DEBIT_NOT_FOUND');
    return debit;
  }

  // Returns whether this call closed the debit (`from` restricts the status it may close).
  private async markCancelled(
    manager: EntityManager,
    id: string,
    reason: AutoDebitCancelReason,
    from: 'pending' | 'active' = 'active',
  ): Promise<boolean> {
    const statuses = from === 'pending' ? ['pending'] : ['pending', 'authorized'];
    const rows: { id: string }[] = await manager.query(
      `WITH cancelled AS (
         UPDATE auto_debits
         SET status = 'cancelled', cancel_reason = $2, cancelled_at = now(), next_charge_date = NULL, updated_at = now()
         WHERE id = $1 AND status = ANY($3::text[]) RETURNING id
       ) SELECT id FROM cancelled`,
      [id, reason, statuses],
    );
    return rows.length > 0;
  }

  // A cancellation Mercado Pago refuses because the subscription is already cancelled there still counts.
  private async cancelAtProvider(preapprovalId: string): Promise<void> {
    try {
      await this.mercadoPago.cancelPreapproval(preapprovalId);
    } catch {
      const current = await this.mercadoPago.getPreapproval(preapprovalId).catch(() => null);
      if (current?.status !== 'cancelled') throw new AppError('PAYMENT_PROVIDER_ERROR');
    }
  }

  // Best effort: a replaced pending subscription left open in Mercado Pago expires by itself on the next runs.
  private async cancelReplacedAtProvider(debit: AutoDebitModel): Promise<void> {
    if (!debit.mpPreapprovalId || this.config.simulatorEnabled) return;
    try {
      await this.cancelAtProvider(debit.mpPreapprovalId);
    } catch {
      this.logger.warn(`auto debit ${debit.id} replaced but not cancelled in Mercado Pago`);
    }
  }

  // D4: the development simulator replaces Mercado Pago when it is not configured.
  private async startPreapproval(
    created: { id: string; externalReference: string },
    plan: PlanModel,
    userId: string,
    frequency: ReturnType<typeof frequencyOf>,
    startDate: string | null,
  ): Promise<string> {
    const ref = created.externalReference;
    if (this.config.simulatorEnabled) return `${this.app.webUrl}/checkout/simulado?debito=${encodeURIComponent(ref)}`;
    try {
      const user = await this.users.findById(userId);
      if (!user) throw new AppError('USER_NOT_FOUND');
      const preapproval = await this.mercadoPago.createPreapproval({
        externalReference: ref, reason: plan.name, payerEmail: user.email, amount: plan.price, startDate, ...frequency,
      });
      await this.dataSource.query(`UPDATE auto_debits SET mp_preapproval_id = $2, updated_at = now() WHERE id = $1`, [
        created.id,
        preapproval.id,
      ]);
      return preapproval.initPoint;
    } catch {
      await this.markCancelled(this.dataSource.manager, created.id, 'provider', 'pending');
      throw new AppError('PAYMENT_PROVIDER_ERROR');
    }
  }

  private async latestPerformanceEnd(userId: string): Promise<string | null> {
    const subs = await this.subscriptions.listPerformanceByUsers([userId]);
    return subs.reduce<string | null>((latest, sub) => (latest === null || sub.endsOn > latest ? sub.endsOn : latest), null);
  }
}
