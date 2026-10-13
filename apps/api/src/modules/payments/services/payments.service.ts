import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { DataSource, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { toPaginated, type Paginated } from '../../../common/http/pagination.js';
import { businessToday } from '../../../common/time/business-time.js';
import { mercadoPagoConfig } from '../../../config/mercado-pago.config.js';
import { displayDate } from '../../bookings/domain/booking-rules.js';
import type { ActivityItemDto } from '../../bookings/models/booking.model.js';
import { BookingsService } from '../../bookings/services/bookings.service.js';
import type { PlanKind, Service } from '../../catalog/entities/plan.entity.js';
import { CatalogService } from '../../catalog/services/catalog.service.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import type { PlanSnapshot, SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import type { ListStaffPaymentsQuery } from '../dto/list-staff-payments.query.js';
import type { ManualMethod } from '../dto/manual-payment.dto.js';
import type { PurchaseStatusDto, StaffPaymentDto } from '../dto/payment-responses.js';
import type { SimulatedOutcome } from '../dto/simulate-payment.dto.js';
import type { PurchaseKind, PurchaseMethod, PurchaseStatus } from '../entities/purchase.entity.js';
import type { ProviderPayment } from '../models/provider-payment.model.js';
import { MercadoPagoService } from './mercado-pago.service.js';

// Plans bought on their own (checkout and manual payments); the other kinds are paid together with a booking.
export const PLAN_PURCHASE_KINDS: PlanKind[] = ['period_plan', 'session_pack'];

const MINUTE_MS = 60_000;
const PLAN_PENDING_LIMIT_MS = 24 * 60 * MINUTE_MS;
const RECONCILE_LOOKBACK_MS = 7 * 24 * 60 * MINUTE_MS;

interface LockedPurchase {
  id: string;
  userId: string;
  kind: PurchaseKind;
  bookingId: string | null;
  amount: number;
  status: PurchaseStatus;
  plan: PlanSnapshot;
}

type LockedPurchaseRow = Omit<LockedPurchase, 'plan'> & {
  planId: string;
  planName: string;
  planService: Service;
  planKind: PlanKind;
  periodMonths: number | null;
  periodDays: number | null;
  sessionsIncluded: number | null;
};

// What an approval changed, for the emails sent after the commit.
interface Approval {
  purchaseId: string;
  userId: string;
  itemName: string;
  amount: number;
  subscription: SubscriptionModel | null;
  confirmedBookingId: string | null;
}

interface StaffPaymentRow {
  purchaseId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  itemName: string;
  service: Service;
  amount: number;
  method: PurchaseMethod;
  status: PurchaseStatus;
  needsAttention: boolean;
  createdAt: Date;
  approvedAt: Date | null;
  note: string | null;
}

const STAFF_PAYMENT_SELECT = `
  SELECT pu.id AS "purchaseId", u.id AS "clientId", u.name AS "clientName", u.email AS "clientEmail",
    pl.name AS "itemName", pl.service, pu.amount, pu.method, pu.status, pu.needs_attention AS "needsAttention",
    pu.created_at AS "createdAt", pu.approved_at AS "approvedAt", pu.note
  FROM purchases pu
  JOIN users u ON u.id = pu.user_id
  JOIN plans pl ON pl.id = pu.plan_id`;

const toStaffPaymentDto = (row: StaffPaymentRow): StaffPaymentDto => ({
  purchaseId: row.purchaseId,
  client: { id: row.clientId, name: row.clientName, email: row.clientEmail },
  itemName: row.itemName,
  service: row.service,
  amount: row.amount,
  method: row.method,
  status: row.status,
  needsAttention: row.needsAttention,
  createdAt: row.createdAt.toISOString(),
  approvedAt: row.approvedAt?.toISOString() ?? null,
  note: row.note,
});

const toLockedPurchase = (row: LockedPurchaseRow): LockedPurchase => ({
  id: row.id,
  userId: row.userId,
  kind: row.kind,
  bookingId: row.bookingId,
  amount: row.amount,
  status: row.status,
  plan: {
    id: row.planId,
    name: row.planName,
    service: row.planService,
    kind: row.planKind,
    periodMonths: row.periodMonths,
    periodDays: row.periodDays,
    sessionsIncluded: row.sessionsIncluded,
  },
});

// Approved payments are tried first, so a rejected attempt never shadows the one that paid.
const approvedFirst = (payments: ProviderPayment[]): ProviderPayment[] =>
  [...payments].sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved'));

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly catalog: CatalogService,
    private readonly subscriptions: SubscriptionsService,
    private readonly bookings: BookingsService,
    private readonly mercadoPago: MercadoPagoService,
    @Inject(mercadoPagoConfig.KEY) private readonly config: ConfigType<typeof mercadoPagoConfig>,
  ) {}

  // R16, idempotent. `payment` comes from the Mercado Pago API (or the simulator), never from a webhook body.
  async applyProviderPayment(payment: ProviderPayment): Promise<void> {
    await this.apply(payment);
  }

  // Pending Mercado Pago purchases older than `reconcileAfterMinutes` (up to 7 days) take their real state from
  // Mercado Pago; then stale purchases expire: bookings whose hold expired and plans pending for more than 24 h.
  async reconcilePending(now: Date): Promise<{ applied: number; expired: number }> {
    let applied = 0;
    if (!this.config.simulatorEnabled) {
      const minutes = await this.settings.get('reconcileAfterMinutes');
      const pending: { externalReference: string }[] = await this.dataSource.query(
        `SELECT external_reference AS "externalReference" FROM purchases
         WHERE status = 'pending' AND method = 'mercadopago' AND deleted_at IS NULL AND created_at < $1 AND created_at > $2
         ORDER BY created_at`,
        [new Date(now.getTime() - minutes * MINUTE_MS), new Date(now.getTime() - RECONCILE_LOOKBACK_MS)],
      );
      for (const { externalReference } of pending) {
        if (await this.reconcileOne(externalReference)) applied += 1;
      }
    }
    return { applied, expired: await this.expireStale(now) };
  }

  // D7: a cash or transfer payment approves the purchase and activates the plan in one transaction.
  async recordManualPayment(
    staffId: string,
    dto: { userId: string; planId: string; method: ManualMethod; amount: number; note?: string | null },
  ): Promise<StaffPaymentDto> {
    const user = await this.users.findById(dto.userId);
    if (!user || user.role !== 'client') throw new AppError('USER_NOT_FOUND');
    const plan = await this.catalog.findById(dto.planId, { includeInactive: true });
    if (!PLAN_PURCHASE_KINDS.includes(plan.kind)) throw new AppError('PLAN_KIND_INVALID');

    const approval = await this.dataSource.transaction(async (manager): Promise<Approval> => {
      const [{ id }]: { id: string }[] = await manager.query(
        `INSERT INTO purchases (user_id, kind, plan_id, amount, method, status, recorded_by, note, approved_at)
         VALUES ($1, 'plan', $2, $3, $4, 'approved', $5, $6, now()) RETURNING id`,
        [user.id, plan.id, dto.amount, dto.method, staffId, dto.note || null],
      );
      await manager.query(`INSERT INTO payments (purchase_id, status, amount, applied_at) VALUES ($1, 'approved', $2, now())`, [
        id,
        dto.amount,
      ]);
      const subscription = await this.subscriptions.activateFromPurchase(manager, {
        purchaseId: id, userId: user.id, plan, today: businessToday(),
      });
      return { purchaseId: id, userId: user.id, itemName: plan.name, amount: dto.amount, subscription, confirmedBookingId: null };
    });
    await this.sendPurchaseApproved(approval);
    return this.getStaffPayment(approval.purchaseId);
  }

  async getPurchaseStatus(externalReference: string): Promise<PurchaseStatusDto> {
    if (!isUUID(externalReference)) throw new AppError('PURCHASE_NOT_FOUND');
    const [row]: (Omit<PurchaseStatusDto, 'startsAt'>)[] = await this.dataSource.query(
      `SELECT pu.external_reference AS "externalReference", pu.status, pu.kind, pl.name AS "itemName", pl.service,
         pu.amount, pu.booking_id AS "bookingId", pu.needs_attention AS "needsAttention"
       FROM purchases pu JOIN plans pl ON pl.id = pu.plan_id
       WHERE pu.external_reference = $1 AND pu.deleted_at IS NULL`,
      [externalReference],
    );
    if (!row) throw new AppError('PURCHASE_NOT_FOUND');
    const booking = row.bookingId ? await this.bookings.getBooking(row.bookingId) : null;
    return { ...row, startsAt: booking?.startsAt.toISOString() ?? null };
  }

  async listStaffPayments(q: ListStaffPaymentsQuery): Promise<Paginated<StaffPaymentDto>> {
    const params: unknown[] = [];
    const conditions = ['pu.deleted_at IS NULL'];
    const filter = (column: string, value: unknown) => {
      params.push(value);
      conditions.push(`${column} = $${params.length}`);
    };
    if (q.status) filter('pu.status', q.status);
    if (q.method) filter('pu.method', q.method);
    if (q.needsAttention !== undefined) filter('pu.needs_attention', q.needsAttention);
    const where = conditions.join(' AND ');

    const [{ total }]: { total: number }[] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM purchases pu WHERE ${where}`,
      params,
    );
    const rows: StaffPaymentRow[] = await this.dataSource.query(
      `${STAFF_PAYMENT_SELECT} WHERE ${where} ORDER BY pu.created_at DESC, pu.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.pageSize, (q.page - 1) * q.pageSize],
    );
    return toPaginated(rows.map(toStaffPaymentDto), total, q);
  }

  // Approved purchases, latest first.
  async listActivityForUser(userId: string): Promise<ActivityItemDto[]> {
    const rows: { itemName: string; service: Service; amount: number; approvedAt: Date }[] = await this.dataSource.query(
      `SELECT pl.name AS "itemName", pl.service, pu.amount, pu.approved_at AS "approvedAt"
       FROM purchases pu JOIN plans pl ON pl.id = pu.plan_id
       WHERE pu.user_id = $1 AND pu.status = 'approved' AND pu.approved_at IS NOT NULL AND pu.deleted_at IS NULL
       ORDER BY pu.approved_at DESC`,
      [userId],
    );
    return rows.map((row) => ({
      type: 'payment',
      label: `Pago — ${row.itemName}`,
      date: row.approvedAt.toISOString(),
      amount: row.amount,
      service: row.service,
    }));
  }

  // D4: development only. Builds the payment Mercado Pago would report and applies it like a webhook would.
  async simulate(externalReference: string, outcome: SimulatedOutcome): Promise<PurchaseStatusDto> {
    if (!this.config.simulatorEnabled) throw new AppError('NOT_FOUND');
    const purchase = await this.getPurchaseStatus(externalReference);
    await this.apply({
      id: `sim-${randomUUID()}`,
      status: outcome,
      statusDetail: outcome === 'approved' ? 'accredited' : 'cc_rejected_other_reason',
      externalReference,
      transactionAmount: purchase.amount,
    });
    return this.getPurchaseStatus(externalReference);
  }

  // Returns whether this payment approved the purchase.
  private async apply(payment: ProviderPayment): Promise<boolean> {
    if (!isUUID(payment.externalReference)) {
      this.logger.warn(`payment ${payment.id} ignored: no purchase reference`);
      return false;
    }
    const approval = await this.dataSource.transaction(async (manager): Promise<Approval | null> => {
      const purchase = await this.lockPurchase(manager, payment.externalReference);
      if (!purchase) {
        this.logger.warn(`payment ${payment.id} ignored: unknown purchase`);
        return null;
      }
      const stored = await this.upsertPayment(manager, purchase.id, payment);
      if (payment.status === 'approved') return this.applyApproved(manager, purchase, payment, stored);
      if ((payment.status === 'rejected' || payment.status === 'cancelled') && purchase.status === 'pending') {
        await this.reject(manager, purchase);
      }
      return null;
    });
    if (!approval) return false;
    await this.sendPurchaseApproved(approval);
    if (approval.confirmedBookingId) await this.bookings.sendBookingConfirmation(approval.confirmedBookingId);
    return true;
  }

  // R16 steps 3–4. An approved payment that cannot be applied (amount mismatch, a purchase already rejected, or a
  // second payment of an approved purchase) is never applied silently: the purchase is flagged for staff.
  private async applyApproved(
    manager: EntityManager,
    purchase: LockedPurchase,
    payment: ProviderPayment,
    stored: { id: string; appliedAt: Date | null },
  ): Promise<Approval | null> {
    if (stored.appliedAt) return null;
    const payable = purchase.status === 'pending' || purchase.status === 'expired';
    if (!payable || payment.transactionAmount !== purchase.amount) {
      await this.flag(manager, purchase.id);
      return null;
    }
    const moved: { id: string }[] = await manager.query(
      `UPDATE purchases SET status = 'approved', approved_at = now(), updated_at = now()
       WHERE id = $1 AND status IN ('pending','expired') RETURNING id`,
      [purchase.id],
    );
    if (moved.length === 0) return null;

    const approval: Approval = {
      purchaseId: purchase.id,
      userId: purchase.userId,
      itemName: purchase.plan.name,
      amount: purchase.amount,
      subscription: null,
      confirmedBookingId: null,
    };
    if (purchase.kind === 'plan') {
      approval.subscription = await this.subscriptions.activateFromPurchase(manager, {
        purchaseId: purchase.id, userId: purchase.userId, plan: purchase.plan, today: businessToday(),
      });
    } else {
      approval.confirmedBookingId = await this.confirmBooking(manager, purchase);
    }
    await manager.query(`UPDATE payments SET applied_at = now(), updated_at = now() WHERE id = $1`, [stored.id]);
    return approval;
  }

  // D23: a paid booking that can no longer be placed leaves the purchase approved and flagged.
  private async confirmBooking(manager: EntityManager, purchase: LockedPurchase): Promise<string | null> {
    if (!purchase.bookingId) throw new AppError('INTERNAL_ERROR');
    try {
      await this.bookings.confirmPaid(manager, purchase.bookingId);
      return purchase.bookingId;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'SLOT_FULL') throw error;
      await this.flag(manager, purchase.id);
      return null;
    }
  }

  // R16 step 5.
  private async reject(manager: EntityManager, purchase: LockedPurchase): Promise<void> {
    await manager.query(`UPDATE purchases SET status = 'rejected', updated_at = now() WHERE id = $1 AND status = 'pending'`, [
      purchase.id,
    ]);
    if (purchase.bookingId) await this.bookings.releaseHold(manager, purchase.bookingId, 'cancelled');
  }

  private async flag(manager: EntityManager, purchaseId: string): Promise<void> {
    await manager.query(`UPDATE purchases SET needs_attention = true, updated_at = now() WHERE id = $1`, [purchaseId]);
  }

  private async lockPurchase(manager: EntityManager, externalReference: string): Promise<LockedPurchase | null> {
    const [row]: LockedPurchaseRow[] = await manager.query(
      `SELECT pu.id, pu.user_id AS "userId", pu.kind, pu.booking_id AS "bookingId", pu.amount, pu.status,
         pl.id AS "planId", pl.name AS "planName", pl.service AS "planService", pl.kind AS "planKind",
         pl.period_months AS "periodMonths", pl.period_days AS "periodDays", pl.sessions_included AS "sessionsIncluded"
       FROM purchases pu JOIN plans pl ON pl.id = pu.plan_id
       WHERE pu.external_reference = $1 AND pu.deleted_at IS NULL
       FOR UPDATE OF pu`,
      [externalReference],
    );
    return row ? toLockedPurchase(row) : null;
  }

  // R16 step 2: one row per Mercado Pago payment, always holding its latest known state.
  private async upsertPayment(
    manager: EntityManager,
    purchaseId: string,
    payment: ProviderPayment,
  ): Promise<{ id: string; appliedAt: Date | null }> {
    const [row]: { id: string; appliedAt: Date | null }[] = await manager.query(
      `INSERT INTO payments (purchase_id, mp_payment_id, status, status_detail, amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (mp_payment_id) DO UPDATE
         SET status = EXCLUDED.status, status_detail = EXCLUDED.status_detail, amount = EXCLUDED.amount, updated_at = now()
       RETURNING id, applied_at AS "appliedAt"`,
      [purchaseId, payment.id, payment.status, payment.statusDetail, Math.round(payment.transactionAmount)],
    );
    return row;
  }

  // A Mercado Pago failure for one purchase must not stop the others.
  private async reconcileOne(externalReference: string): Promise<boolean> {
    try {
      let approved = false;
      for (const payment of approvedFirst(await this.mercadoPago.searchByExternalReference(externalReference))) {
        if (await this.apply(payment)) approved = true;
      }
      return approved;
    } catch {
      this.logger.warn(`reconcile failed purchase=${externalReference}`);
      return false;
    }
  }

  private async expireStale(now: Date): Promise<number> {
    const [{ count }]: { count: number }[] = await this.dataSource.query(
      `WITH expired AS (
         UPDATE purchases pu SET status = 'expired', updated_at = now()
         WHERE pu.status = 'pending' AND pu.deleted_at IS NULL AND (
           (pu.kind = 'booking' AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = pu.booking_id AND b.status = 'expired'))
           OR (pu.kind = 'plan' AND pu.created_at < $1)
         )
         RETURNING pu.id
       ) SELECT count(*)::int AS count FROM expired`,
      [new Date(now.getTime() - PLAN_PENDING_LIMIT_MS)],
    );
    return count;
  }

  private async getStaffPayment(purchaseId: string): Promise<StaffPaymentDto> {
    const [row]: StaffPaymentRow[] = await this.dataSource.query(`${STAFF_PAYMENT_SELECT} WHERE pu.id = $1`, [purchaseId]);
    if (!row) throw new AppError('PURCHASE_NOT_FOUND');
    return toStaffPaymentDto(row);
  }

  // Never throws: the purchase is already committed when this runs.
  private async sendPurchaseApproved(approval: Approval): Promise<void> {
    try {
      const user = await this.users.findById(approval.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'purchase-approved',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `purchase-approved:${approval.purchaseId}`,
        params: {
          name: user.name,
          itemName: approval.itemName,
          amount: approval.amount,
          endsOn: approval.subscription ? displayDate(approval.subscription.endsOn) : null,
          sessionsTotal: approval.subscription?.sessionsTotal ?? null,
        },
      });
    } catch {
      this.logger.error(`purchase-approved email failed purchase=${approval.purchaseId}`);
    }
  }
}
