import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { SlotChips } from './slot-chips';

const slot = (over: Partial<StaffTimeSlotDto>): StaffTimeSlotDto => ({
  id: 's1', service: 'rehab', startsAt: '2026-10-12T21:00:00.000Z', endsAt: '2026-10-12T22:00:00.000Z', capacity: 1,
  professional: null, cancelledAt: null, calendarBlocked: false, calendarConflict: false,
  booked: 0, present: 0, absent: 0, noShow: 0, cancelled: 0, pendingAttendance: 0, ...over,
});

describe('SlotChips', () => {
  it('shows no calendar badge on regular slots', () => {
    render(<SlotChips slots={[slot({ id: 's1' })]} selectedId="s1" onSelect={vi.fn()} />);
    expect(screen.queryByText('Ocupado en Google Calendar')).toBeNull();
    expect(screen.queryByText('Conflicto con Google Calendar')).toBeNull();
  });

  it('marks a slot blocked by Google Calendar with a warning badge tied to its chip', () => {
    render(
      <SlotChips
        slots={[slot({ id: 's1' }), slot({ id: 's2', startsAt: '2026-10-12T22:00:00.000Z', calendarBlocked: true })]}
        selectedId="s1"
        onSelect={vi.fn()}
      />,
    );
    const badge = screen.getByText('Ocupado en Google Calendar');
    expect(badge).toHaveClass('text-warning');
    expect(screen.queryByText('Conflicto con Google Calendar')).toBeNull();
    const chip = screen.getByRole('button', { name: /19:00/ });
    expect(chip).toHaveAccessibleDescription('Ocupado en Google Calendar');
    expect(screen.getByRole('button', { name: /18:00/ })).not.toHaveAccessibleDescription('Ocupado en Google Calendar');
  });

  it('shows a danger conflict badge, and only that one, when a blocked slot still has bookings', () => {
    render(<SlotChips slots={[slot({ calendarBlocked: true, calendarConflict: true, booked: 1 })]} selectedId="s1" onSelect={vi.fn()} />);
    const badge = screen.getByText('Conflicto con Google Calendar');
    expect(badge).toHaveClass('text-danger');
    expect(screen.queryByText('Ocupado en Google Calendar')).toBeNull();
    expect(screen.getByRole('button', { name: /18:00/ })).toHaveAccessibleDescription('Conflicto con Google Calendar');
  });

  it('keeps the chip selectable when it carries a badge', async () => {
    const onSelect = vi.fn();
    render(<SlotChips slots={[slot({ id: 's2', calendarBlocked: true })]} selectedId={null} onSelect={onSelect} />);
    const group = screen.getByRole('group', { name: 'Turnos del día' });
    await userEvent.click(within(group).getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('s2');
  });
});
