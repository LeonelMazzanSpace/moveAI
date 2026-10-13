import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { PendingAttendanceBanner } from './pending-attendance-banner';

const slot = (over: Partial<StaffTimeSlotDto>): StaffTimeSlotDto => ({
  id: 's1', service: 'performance', startsAt: '2026-10-12T21:00:00.000Z', endsAt: '2026-10-12T22:00:00.000Z', capacity: 14,
  professional: null, cancelledAt: null, booked: 12, present: 8, absent: 1, noShow: 1, cancelled: 1, pendingAttendance: 2, ...over,
});

describe('PendingAttendanceBanner', () => {
  it('links to the slot on its local business day', () => {
    render(<PendingAttendanceBanner slots={[slot({})]} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/staff/turnos?fecha=2026-10-12&servicio=performance&turno=s1');
  });

  it('links to the slot without a date when its start is not a valid instant', () => {
    render(<PendingAttendanceBanner slots={[slot({ startsAt: 'not-a-date' })]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/staff/turnos?servicio=performance&turno=s1');
    expect(link.getAttribute('href')).not.toContain('fecha=');
    expect(link).toHaveTextContent('(2 sin marcar)');
  });
});
