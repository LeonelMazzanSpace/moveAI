import { businessDateTime } from '../../../common/time/business-time.js';
import type { BookingModel } from '../../bookings/models/booking.model.js';
import type { BookingsService } from '../../bookings/services/bookings.service.js';
import type { NotificationsService } from '../../notifications/services/notifications.service.js';
import type { UsersService } from '../../users/services/users.service.js';
import { BookingRemindersService } from './booking-reminders.service.js';

const booking = (id: string, userId: string): BookingModel => ({
  id,
  userId,
  timeSlotId: `slot-${id}`,
  service: 'recovery',
  startsAt: businessDateTime('2026-10-15', '10:00'),
  endsAt: businessDateTime('2026-10-15', '10:45'),
  status: 'confirmed',
  source: 'package',
  subscriptionId: null,
  holdExpiresAt: null,
  cancelledAt: null,
});

describe('BookingRemindersService', () => {
  // T-060 M-4: `sent` counts only mails the provider accepted; dry-run, duplicates, failures and missing users are skipped.
  it('counts as sent only the reminders the provider accepted', async () => {
    const bookings = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id, i) => booking(id, i === 4 ? 'gone' : `u${i + 1}`));
    const send = vi.fn()
      .mockResolvedValueOnce('sent')
      .mockResolvedValueOnce('skipped')
      .mockResolvedValueOnce('duplicate')
      .mockResolvedValueOnce('failed');
    const service = new BookingRemindersService(
      { listConfirmedStartingBetween: vi.fn().mockResolvedValue(bookings) } as unknown as BookingsService,
      {
        findByIds: vi.fn().mockResolvedValue(['u1', 'u2', 'u3', 'u4'].map((id) => ({ id, name: 'Ana', email: `${id}@test.move` }))),
      } as unknown as UsersService,
      { send } as unknown as NotificationsService,
    );

    await expect(service.run(businessDateTime('2026-10-14', '18:00'))).resolves.toEqual({ sent: 1, skipped: 4 });
    expect(send).toHaveBeenCalledTimes(4);
  });
});
