import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TimeSlotDto } from '@/lib/api/types';
import { SlotGrid } from './slot-grid';

const slot = (over: Partial<TimeSlotDto>): TimeSlotDto => ({
  id: 's', service: 'performance', startsAt: '2026-10-12T22:00:00.000Z', endsAt: '2026-10-12T23:00:00.000Z',
  capacity: 14, booked: 13, available: 1, isFull: false, professional: null, bookedByMe: false, ...over,
});

describe('SlotGrid', () => {
  it('renders capacity, full and booked states', async () => {
    const onBook = vi.fn();
    render(
      <SlotGrid
        slots={[
          slot({ id: 'a' }),
          slot({ id: 'b', startsAt: '2026-10-12T12:00:00.000Z', booked: 14, available: 0, isFull: true }),
          slot({ id: 'c', startsAt: '2026-10-12T23:00:00.000Z', bookedByMe: true }),
        ]}
        onBook={onBook}
      />,
    );
    expect(screen.getAllByText('13 / 14 cupos')).toHaveLength(2);
    expect(screen.getByText('14 / 14 cupos')).toBeInTheDocument();
    expect(screen.getByText('Completo')).toBeInTheDocument();
    expect(screen.getByText('Reservado')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Reservar' });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('disables the booking buttons while a slot is being booked', () => {
    render(<SlotGrid slots={[slot({ id: 'a' }), slot({ id: 'b' })]} onBook={vi.fn()} pendingSlotId="a" />);
    for (const button of screen.getAllByRole('button', { name: 'Reservar' })) {
      expect(button).toBeDisabled();
    }
  });
});
