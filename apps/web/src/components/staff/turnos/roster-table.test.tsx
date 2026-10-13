import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RosterItemDto } from '@/lib/api/types';
import { RosterTable } from './roster-table';

const row = (over: Partial<RosterItemDto>): RosterItemDto => ({
  bookingId: 'b', client: { id: 'c', name: 'Martina Suárez' }, planName: 'Trimestral', lastAttendanceOn: '2026-10-10',
  status: 'confirmed', attendance: null, cancelledAt: null, ...over,
});

describe('RosterTable', () => {
  it('marks attendance and shows cancelled rows', async () => {
    const onMark = vi.fn();
    render(
      <RosterTable
        rows={[row({ bookingId: 'b1' }), row({ bookingId: 'b2', client: { id: 'r', name: 'Rodrigo Silva' }, status: 'cancelled', cancelledAt: '2026-10-12T00:14:00.000Z' })]}
        canMark
        onMark={onMark}
      />,
    );
    const first = screen.getByRole('row', { name: /Martina Suárez/ });
    expect(within(first).getByText('Pendiente')).toBeInTheDocument();
    await userEvent.click(within(first).getByRole('button', { name: 'No show' }));
    expect(onMark).toHaveBeenCalledWith('b1', 'no_show');
    const cancelled = screen.getByRole('row', { name: /Rodrigo Silva/ });
    expect(within(cancelled).getByText('Canceló 11/10 — 21:14')).toBeInTheDocument();
    expect(within(cancelled).queryByRole('button', { name: 'Presente' })).toBeNull();
  });

  it('disables the attendance buttons with a hint when marking is not allowed yet', async () => {
    const onMark = vi.fn();
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark={false} onMark={onMark} />);
    const button = screen.getByRole('button', { name: 'Presente' });
    expect(button).toBeDisabled();
    expect(button.closest('[title]')).toHaveAttribute('title', 'Disponible desde el día del turno');
    await userEvent.click(button);
    expect(onMark).not.toHaveBeenCalled();
  });

  it('tints the active attendance button and shows its state', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1', attendance: 'absent' })]} canMark onMark={vi.fn()} />);
    const first = screen.getByRole('row', { name: /Martina Suárez/ });
    expect(within(first).getByText('Ausente')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Ausente' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(first).getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers to cancel an active booking', async () => {
    const onCancel = vi.fn();
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark onMark={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar reserva de Martina Suárez' }));
    expect(onCancel).toHaveBeenCalledWith('b1');
  });
});
