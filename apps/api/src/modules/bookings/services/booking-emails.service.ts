import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { businessTime, toBusinessDate } from '../../../common/time/business-time.js';
import { appConfig } from '../../../config/app.config.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { SERVICE_LABEL, bookingLabel, displayDate, durationMinutes } from '../domain/booking-rules.js';
import type { BookingSource } from '../entities/booking.entity.js';

export type NotConfirmedReason = 'payment_rejected' | 'hold_expired';

interface EmailBooking {
  id: string;
  userId: string;
  service: Service;
  source: BookingSource;
  startsAt: Date;
  endsAt: Date;
  professionalName: string | null;
  confirmedAt: Date | null;
}

type StaffEvent = 'confirmed' | 'cancelled';

// Booking emails (D93) in one place: the client's mail plus, for Rehab, the notice to the staff address. They run after
// the booking transaction committed, so nothing here ever throws.
@Injectable()
export class BookingEmailsService {
  private readonly logger = new Logger(BookingEmailsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async confirmed(bookingId: string): Promise<void> {
    await this.guarded('booking-confirmed', [bookingId], async ([booking]) => {
      const user = await this.users.findById(booking.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'booking-confirmed',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `booking-confirmed:${booking.id}`,
        params: {
          name: user.name,
          serviceName: SERVICE_LABEL[booking.service],
          label: labelOf(booking),
          date: displayDate(toBusinessDate(booking.startsAt)),
          time: businessTime(booking.startsAt),
        },
      });
      await this.notifyStaff(booking, user.name, 'confirmed');
    });
  }

  async cancelledByClient(bookingId: string): Promise<void> {
    await this.guarded('booking-cancelled-by-client', [bookingId], async ([booking]) => {
      const user = await this.users.findById(booking.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'booking-cancelled-by-client',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `booking-cancelled-by-client:${booking.id}`,
        params: {
          name: user.name,
          serviceName: SERVICE_LABEL[booking.service],
          date: displayDate(toBusinessDate(booking.startsAt)),
          time: businessTime(booking.startsAt),
        },
      });
      await this.notifyStaff(booking, user.name, 'cancelled');
    });
  }

  async cancelledByStaff(bookingId: string): Promise<void> {
    await this.guarded('booking-cancelled', [bookingId], async ([booking]) => {
      const user = await this.users.findById(booking.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'booking-cancelled',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `booking-cancelled:${booking.id}`,
        params: {
          name: user.name,
          serviceName: SERVICE_LABEL[booking.service],
          date: displayDate(toBusinessDate(booking.startsAt)),
          time: businessTime(booking.startsAt),
        },
      });
      await this.notifyStaff(booking, user.name, 'cancelled');
    });
  }

  async notConfirmed(bookingIds: string[], reason: NotConfirmedReason): Promise<void> {
    if (bookingIds.length === 0) return;
    await this.guarded('booking-not-confirmed', bookingIds, async (bookings) => {
      for (const booking of bookings) {
        await this.sendNotConfirmed(booking, reason).catch(() => {
          this.logger.error(`booking-not-confirmed email failed booking=${booking.id}`);
        });
      }
    });
  }

  private async sendNotConfirmed(booking: EmailBooking, reason: NotConfirmedReason): Promise<void> {
    const user = await this.users.findById(booking.userId);
    if (!user) return;
    await this.notifications.send({
      template: 'booking-not-confirmed',
      to: { email: user.email, name: user.name },
      userId: user.id,
      idempotencyKey: `booking-not-confirmed:${booking.id}`,
      params: {
        name: user.name,
        serviceName: SERVICE_LABEL[booking.service],
        date: displayDate(toBusinessDate(booking.startsAt)),
        time: businessTime(booking.startsAt),
        reason,
        retryUrl: `${this.app.webUrl}/reservar`,
      },
    });
  }

  // Rehab only. A cancellation is only worth a notice if the staff address was told about the booking, i.e. it was
  // confirmed at some point; a hold that never got paid stays silent.
  private async notifyStaff(booking: EmailBooking, clientName: string, event: StaffEvent): Promise<void> {
    if (booking.service !== 'rehab') return;
    if (event === 'cancelled' && !booking.confirmedAt) return;
    await this.notifications.sendToStaff({
      template: 'staff-rehab-booking',
      idempotencyKey: `staff-rehab-booking:${booking.id}:${event}`,
      params: {
        event,
        clientName,
        label: labelOf(booking),
        professionalName: booking.professionalName,
        date: displayDate(toBusinessDate(booking.startsAt)),
        time: businessTime(booking.startsAt),
      },
    });
  }

  private async guarded(template: string, bookingIds: string[], body: (bookings: EmailBooking[]) => Promise<void>): Promise<void> {
    try {
      const bookings = await this.load(bookingIds);
      if (bookings.length === 0) return;
      await body(bookings);
    } catch {
      this.logger.error(`${template} email failed bookings=${bookingIds.join(',')}`);
    }
  }

  private load(bookingIds: string[]): Promise<EmailBooking[]> {
    return this.dataSource.query(
      `SELECT b.id, b.user_id AS "userId", s.service, b.source, s.starts_at AS "startsAt", s.ends_at AS "endsAt",
         p.name AS "professionalName", b.confirmed_at AS "confirmedAt"
       FROM bookings b
       JOIN time_slots s ON s.id = b.time_slot_id
       LEFT JOIN professionals p ON p.id = s.professional_id
       WHERE b.id = ANY($1::uuid[])
       ORDER BY s.starts_at, b.created_at`,
      [bookingIds],
    );
  }
}

const labelOf = (booking: EmailBooking): string =>
  bookingLabel(booking.service, booking.source, durationMinutes(booking.startsAt, booking.endsAt));
