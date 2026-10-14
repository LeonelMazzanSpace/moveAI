import { Injectable } from '@nestjs/common';
import { businessTime, businessToday, toBusinessDate } from '../../../common/time/business-time.js';
import { SERVICE_LABEL, bookingLabel, displayDate, durationMinutes } from '../../bookings/domain/booking-rules.js';
import { BookingsService } from '../../bookings/services/bookings.service.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { reminderWindow, selectBookingReminders } from '../domain/booking-reminders.js';

// D93: the day before, remind clients of their Rehab and Recovery bookings. Idempotent per booking: `NotificationsService`
// skips an idempotency key it already logged. Paused clients are included: it is a transactional email, not retention.
@Injectable()
export class BookingRemindersService {
  constructor(
    private readonly bookings: BookingsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  // `sent`: reminders the mail provider accepted (T-060 M-4); `skipped`: dry-run, already sent, failed or no user.
  async run(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const today = businessToday(now);
    const { from, to } = reminderWindow(today);
    const reminders = selectBookingReminders(today, await this.bookings.listConfirmedStartingBetween(from, to));
    const clients = new Map((await this.users.findByIds([...new Set(reminders.map((b) => b.userId))])).map((u) => [u.id, u]));

    const counts = { sent: 0, skipped: 0 };
    for (const booking of reminders) {
      const user = clients.get(booking.userId);
      const result = user
        ? await this.notifications.send({
            template: 'booking-reminder',
            to: { email: user.email, name: user.name },
            userId: user.id,
            idempotencyKey: `booking-reminder:${booking.id}`,
            params: {
              name: user.name,
              serviceName: SERVICE_LABEL[booking.service],
              label: bookingLabel(booking.service, booking.source, durationMinutes(booking.startsAt, booking.endsAt)),
              date: displayDate(toBusinessDate(booking.startsAt)),
              time: businessTime(booking.startsAt),
            },
          })
        : 'failed';
      counts[result === 'sent' ? 'sent' : 'skipped'] += 1;
    }
    return counts;
  }
}
