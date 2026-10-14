import { vi, type Mock } from 'vitest';
import { businessDateTime } from '../../../common/time/business-time.js';
import type { NotificationsService } from '../../notifications/services/notifications.service.js';
import type { UsersService } from '../../users/services/users.service.js';
import type { DataSource } from 'typeorm';
import { BookingEmailsService } from './booking-emails.service.js';

type Row = {
  id: string; userId: string; service: 'performance' | 'rehab' | 'recovery'; source: 'plan' | 'package' | 'payment' | 'followup';
  startsAt: Date; endsAt: Date; professionalName: string | null; confirmedAt: Date | null;
};

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 'b1', userId: 'u1', service: 'recovery', source: 'package',
  startsAt: businessDateTime('2026-10-15', '10:00'), endsAt: businessDateTime('2026-10-15', '10:45'),
  professionalName: null, confirmedAt: new Date('2026-10-10T12:00:00Z'), ...overrides,
});

const setup = (rows: Row[], options: { user?: boolean } = {}) => {
  const query = vi.fn().mockResolvedValue(rows);
  const send = vi.fn().mockResolvedValue('sent');
  const sendToStaff = vi.fn().mockResolvedValue('sent');
  const findById = vi.fn().mockResolvedValue(options.user === false ? null : { id: 'u1', name: 'Ana Pérez', email: 'ana@test.move' });
  const service = new BookingEmailsService(
    { query } as unknown as DataSource,
    { findById } as unknown as UsersService,
    { send, sendToStaff } as unknown as NotificationsService,
    { webUrl: 'https://move.test' } as never,
  );
  return { service, query, send, sendToStaff, findById };
};

const calls = (mock: Mock) => mock.mock.calls.map(([input]) => input);

describe('BookingEmailsService', () => {
  describe('confirmed', () => {
    it('emails the client with the confirmation params and no staff copy for non-Rehab bookings', async () => {
      const { service, send, sendToStaff } = setup([row()]);
      await service.confirmed('b1');
      expect(calls(send)).toEqual([
        {
          template: 'booking-confirmed', to: { email: 'ana@test.move', name: 'Ana Pérez' }, userId: 'u1',
          idempotencyKey: 'booking-confirmed:b1',
          params: { name: 'Ana Pérez', serviceName: 'Recovery', label: 'Sesión Recovery · 45 min', date: '15/10/2026', time: '10:00' },
        },
      ]);
      expect(sendToStaff).not.toHaveBeenCalled();
    });

    it('also notifies the staff address for a Rehab booking, with the professional', async () => {
      const { service, sendToStaff } = setup([
        row({ service: 'rehab', source: 'payment', professionalName: 'Fisio Test', endsAt: businessDateTime('2026-10-15', '11:00') }),
      ]);
      await service.confirmed('b1');
      expect(calls(sendToStaff)).toEqual([
        {
          template: 'staff-rehab-booking', idempotencyKey: 'staff-rehab-booking:b1:confirmed',
          params: {
            event: 'confirmed', clientName: 'Ana Pérez', label: 'Evaluación y Diagnóstico · 60 min',
            professionalName: 'Fisio Test', date: '15/10/2026', time: '10:00',
          },
        },
      ]);
    });

    it('does nothing when the booking or the user no longer exists', async () => {
      const missingBooking = setup([]);
      await missingBooking.service.confirmed('b1');
      expect(missingBooking.send).not.toHaveBeenCalled();
      const missingUser = setup([row()], { user: false });
      await missingUser.service.confirmed('b1');
      expect(missingUser.send).not.toHaveBeenCalled();
      expect(missingUser.sendToStaff).not.toHaveBeenCalled();
    });
  });

  describe('cancelledByClient', () => {
    it('sends booking-cancelled-by-client keyed by booking', async () => {
      const { service, send, sendToStaff } = setup([row()]);
      await service.cancelledByClient('b1');
      expect(calls(send)).toEqual([
        {
          template: 'booking-cancelled-by-client', to: { email: 'ana@test.move', name: 'Ana Pérez' }, userId: 'u1',
          idempotencyKey: 'booking-cancelled-by-client:b1',
          params: { name: 'Ana Pérez', serviceName: 'Recovery', date: '15/10/2026', time: '10:00' },
        },
      ]);
      expect(sendToStaff).not.toHaveBeenCalled();
    });

    it('tells the staff address when a confirmed Rehab booking is cancelled', async () => {
      const { service, sendToStaff } = setup([row({ service: 'rehab', source: 'followup', professionalName: null })]);
      await service.cancelledByClient('b1');
      expect(calls(sendToStaff)).toEqual([
        {
          template: 'staff-rehab-booking', idempotencyKey: 'staff-rehab-booking:b1:cancelled',
          params: {
            event: 'cancelled', clientName: 'Ana Pérez', label: 'Seguimiento fisioterapéutico · 45 min',
            professionalName: null, date: '15/10/2026', time: '10:00',
          },
        },
      ]);
    });
  });

  describe('cancelledByStaff', () => {
    it('keeps the existing booking-cancelled email for the client', async () => {
      const { service, send } = setup([row()]);
      await service.cancelledByStaff('b1');
      expect(calls(send)).toMatchObject([{ template: 'booking-cancelled', idempotencyKey: 'booking-cancelled:b1' }]);
    });

    it('does not tell the staff address about a Rehab hold that was never confirmed', async () => {
      const { service, send, sendToStaff } = setup([row({ service: 'rehab', source: 'payment', confirmedAt: null })]);
      await service.cancelledByStaff('b1');
      expect(send).toHaveBeenCalledTimes(1);
      expect(sendToStaff).not.toHaveBeenCalled();
    });

    it('tells the staff address about a confirmed Rehab booking', async () => {
      const { service, sendToStaff } = setup([row({ service: 'rehab', source: 'payment' })]);
      await service.cancelledByStaff('b1');
      expect(calls(sendToStaff)).toMatchObject([{ template: 'staff-rehab-booking', idempotencyKey: 'staff-rehab-booking:b1:cancelled' }]);
    });
  });

  describe('notConfirmed', () => {
    it('emails each client once per booking with the reason and a link to book again', async () => {
      const { service, send, sendToStaff } = setup([row({ id: 'b1' }), row({ id: 'b2', userId: 'u1' })]);
      await service.notConfirmed(['b1', 'b2'], 'hold_expired');
      expect(calls(send)).toMatchObject([
        {
          template: 'booking-not-confirmed', idempotencyKey: 'booking-not-confirmed:b1', userId: 'u1',
          params: { name: 'Ana Pérez', serviceName: 'Recovery', date: '15/10/2026', time: '10:00', reason: 'hold_expired', retryUrl: 'https://move.test/reservar' },
        },
        { template: 'booking-not-confirmed', idempotencyKey: 'booking-not-confirmed:b2' },
      ]);
      expect(sendToStaff).not.toHaveBeenCalled();
    });

    it('passes the payment_rejected reason through', async () => {
      const { service, send } = setup([row()]);
      await service.notConfirmed(['b1'], 'payment_rejected');
      expect(calls(send)[0].params.reason).toBe('payment_rejected');
    });

    it('does not even query without ids', async () => {
      const { service, query, send } = setup([]);
      await service.notConfirmed([], 'hold_expired');
      expect(query).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  });

  it('never throws: a failing lookup or send is swallowed', async () => {
    const failingQuery = setup([row()]);
    failingQuery.query.mockRejectedValue(new Error('db down'));
    await expect(failingQuery.service.confirmed('b1')).resolves.toBeUndefined();
    await expect(failingQuery.service.cancelledByClient('b1')).resolves.toBeUndefined();
    await expect(failingQuery.service.cancelledByStaff('b1')).resolves.toBeUndefined();
    await expect(failingQuery.service.notConfirmed(['b1'], 'hold_expired')).resolves.toBeUndefined();

    const failingSend = setup([row({ service: 'rehab' })]);
    failingSend.send.mockRejectedValue(new Error('boom'));
    await expect(failingSend.service.confirmed('b1')).resolves.toBeUndefined();
  });

  it('keeps going with the other bookings when one of them fails', async () => {
    const { service, send } = setup([row({ id: 'b1' }), row({ id: 'b2' })]);
    send.mockRejectedValueOnce(new Error('boom'));
    await service.notConfirmed(['b1', 'b2'], 'hold_expired');
    expect(calls(send)).toHaveLength(2);
  });
});
