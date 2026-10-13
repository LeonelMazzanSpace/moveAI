import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import { appConfig } from '../../../config/app.config.js';
import { mercadoPagoConfig } from '../../../config/mercado-pago.config.js';
import { AuthService } from '../../auth/services/auth.service.js';
import { isBookable } from '../../bookings/domain/booking-rules.js';
import { BookingsService } from '../../bookings/services/bookings.service.js';
import { SlotStatsService } from '../../bookings/services/slot-stats.service.js';
import type { PlanKind } from '../../catalog/entities/plan.entity.js';
import type { PlanModel } from '../../catalog/models/plan.model.js';
import { CatalogService } from '../../catalog/services/catalog.service.js';
import type { TimeSlotModel } from '../../schedule/models/time-slot.model.js';
import { ScheduleService } from '../../schedule/services/schedule.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { UsersService } from '../../users/services/users.service.js';
import type { CheckoutBookingDto, GuestDto } from '../dto/checkout-booking.dto.js';
import type { CheckoutResponseDto } from '../dto/payment-responses.js';
import type { PurchaseKind } from '../entities/purchase.entity.js';
import { MercadoPagoService } from './mercado-pago.service.js';
import { PLAN_PURCHASE_KINDS } from './payments.service.js';

// Products paid together with a booking (R8): the Rehab evaluation and the single Recovery session.
const BOOKING_PURCHASE_KINDS: PlanKind[] = ['evaluation', 'single_session'];

interface NewPurchase { id: string; externalReference: string; bookingId: string | null }

@Injectable()
export class CheckoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogService,
    private readonly schedule: ScheduleService,
    private readonly bookings: BookingsService,
    private readonly slotStats: SlotStatsService,
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly mercadoPago: MercadoPagoService,
    @Inject(mercadoPagoConfig.KEY) private readonly config: ConfigType<typeof mercadoPagoConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async checkoutPlan(userId: string, planId: string): Promise<CheckoutResponseDto> {
    const plan = await this.loadPlan(planId, PLAN_PURCHASE_KINDS);
    const purchase = await this.insertPurchase(this.dataSource.manager, { userId, kind: 'plan', plan, bookingId: null });
    const initPoint = await this.startPayment(purchase, plan, userId, null);
    return { purchaseId: purchase.id, externalReference: purchase.externalReference, initPoint, bookingId: null, holdExpiresAt: null };
  }

  // R8 + R17: the spot is held and the purchase created in one transaction; Mercado Pago is called after the commit.
  async checkoutBooking(viewer: AuthUser | undefined, dto: CheckoutBookingDto): Promise<CheckoutResponseDto> {
    const plan = await this.loadPlan(dto.planId, BOOKING_PURCHASE_KINDS);
    const service = plan.service;
    if (service === 'performance') throw new AppError('PLAN_KIND_INVALID');
    const slot = await this.schedule.getSlot(dto.timeSlotId);
    if (slot.service !== service) throw new AppError('SERVICE_MISMATCH');
    const userId = viewer ? viewer.id : await this.resolveGuest(dto.guest, slot);
    const holdMinutes = await this.settings.get('pendingPaymentMinutes');

    const { purchase, holdExpiresAt } = await this.dataSource.transaction(async (manager) => {
      const hold = await this.bookings.holdForPayment(manager, { userId, timeSlotId: slot.id, expectedService: service, holdMinutes });
      const created = await this.insertPurchase(manager, { userId, kind: 'booking', plan, bookingId: hold.id });
      return { purchase: created, holdExpiresAt: hold.holdExpiresAt };
    });
    const initPoint = await this.startPayment(purchase, plan, userId, holdExpiresAt);
    return {
      purchaseId: purchase.id,
      externalReference: purchase.externalReference,
      initPoint,
      bookingId: purchase.bookingId,
      holdExpiresAt: holdExpiresAt?.toISOString() ?? null,
    };
  }

  private async loadPlan(planId: string, kinds: PlanKind[]): Promise<PlanModel> {
    const plan = await this.catalog.findById(planId, { includeInactive: true });
    if (!kinds.includes(plan.kind)) throw new AppError('PLAN_KIND_INVALID');
    if (!plan.active) throw new AppError('PLAN_INACTIVE');
    return plan;
  }

  // R17 (D21). The slot is checked before the account exists, so a guest who cannot book is not left with one.
  private async resolveGuest(guest: GuestDto | undefined, slot: TimeSlotModel): Promise<string> {
    if (!guest) throw new AppError('GUEST_DATA_REQUIRED');
    if (await this.auth.emailExists(guest.email)) throw new AppError('LOGIN_REQUIRED');
    await this.assertSlotOpen(slot);
    try {
      const { userId } = await this.auth.createInvitedUser(guest);
      return userId;
    } catch (error) {
      if (error instanceof AppError && error.code === 'EMAIL_ALREADY_REGISTERED') throw new AppError('LOGIN_REQUIRED');
      throw error;
    }
  }

  // Unlocked pre-check of R6 steps 2 and 4; `holdForPayment` repeats them under the slot lock.
  private async assertSlotOpen(slot: TimeSlotModel): Promise<void> {
    const now = new Date();
    const windowDays = await this.settings.get('bookingWindowDays');
    if (!isBookable(slot, now, businessToday(now), windowDays)) throw new AppError('SLOT_NOT_BOOKABLE');
    if ((await this.slotStats.countActive(this.dataSource.manager, slot.id)) >= slot.capacity) throw new AppError('SLOT_FULL');
  }

  private async insertPurchase(
    manager: EntityManager,
    input: { userId: string; kind: PurchaseKind; plan: PlanModel; bookingId: string | null },
  ): Promise<NewPurchase> {
    const [row]: { id: string; externalReference: string }[] = await manager.query(
      `INSERT INTO purchases (user_id, kind, plan_id, booking_id, amount, method)
       VALUES ($1, $2, $3, $4, $5, 'mercadopago')
       RETURNING id, external_reference AS "externalReference"`,
      [input.userId, input.kind, input.plan.id, input.bookingId, input.plan.price],
    );
    return { ...row, bookingId: input.bookingId };
  }

  // D4: the development simulator replaces Mercado Pago when it is not configured. If Mercado Pago fails, the
  // purchase is cancelled and its hold released before answering PAYMENT_PROVIDER_ERROR.
  private async startPayment(purchase: NewPurchase, plan: PlanModel, userId: string, expiresAt: Date | null): Promise<string> {
    const ref = purchase.externalReference;
    if (this.config.simulatorEnabled) return `${this.app.webUrl}/checkout/simulado?ref=${encodeURIComponent(ref)}`;
    try {
      const user = await this.users.findById(userId);
      if (!user) throw new AppError('USER_NOT_FOUND');
      const preference = await this.mercadoPago.createPreference({
        externalReference: ref, title: plan.name, unitPrice: plan.price, payer: { email: user.email, name: user.name }, expiresAt,
      });
      await this.dataSource.query(`UPDATE purchases SET mp_preference_id = $2, updated_at = now() WHERE id = $1`, [
        purchase.id,
        preference.id,
      ]);
      return preference.initPoint;
    } catch {
      await this.abandon(purchase);
      throw new AppError('PAYMENT_PROVIDER_ERROR');
    }
  }

  private async abandon(purchase: NewPurchase): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE purchases SET status = 'cancelled', updated_at = now() WHERE id = $1 AND status = 'pending'`, [
        purchase.id,
      ]);
      if (purchase.bookingId) await this.bookings.releaseHold(manager, purchase.bookingId, 'cancelled');
    });
  }
}
