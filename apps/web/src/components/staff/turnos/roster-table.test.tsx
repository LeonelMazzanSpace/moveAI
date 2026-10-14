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

  it('disables the attendance buttons with an accessible hint when marking is not allowed yet', async () => {
    const onMark = vi.fn();
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark={false} markHint="Disponible desde el día del turno" onMark={onMark} />);
    const button = screen.getByRole('button', { name: 'Presente' });
    expect(button).toBeDisabled();
    expect(button.closest('[title]')).toHaveAttribute('title', 'Disponible desde el día del turno');
    for (const name of ['Presente', 'Ausente', 'No show']) {
      const hintId = screen.getByRole('button', { name }).getAttribute('aria-describedby');
      expect(hintId).toBeTruthy();
      expect(document.getElementById(hintId ?? '')).toHaveTextContent('Disponible desde el día del turno');
    }
    await userEvent.click(button);
    expect(onMark).not.toHaveBeenCalled();
  });

  it('gives every row its own hint element', () => {
    render(
      <RosterTable
        rows={[row({ bookingId: 'b1' }), row({ bookingId: 'b2', client: { id: 'r', name: 'Rodrigo Silva' } })]}
        canMark={false}
        markHint="Disponible desde el día del turno"
        onMark={vi.fn()}
      />,
    );
    const ids = screen.getAllByRole('button', { name: 'Presente' }).map((button) => button.getAttribute('aria-describedby'));
    expect(new Set(ids).size).toBe(2);
  });

  it('shows no hint and no description when there is nothing to explain', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark={false} onMark={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Presente' });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-describedby');
    expect(button.closest('[title]')).toBeNull();
  });

  it('shows no hint while marking is allowed', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark markHint="Disponible desde el día del turno" onMark={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Presente' })).not.toHaveAttribute('aria-describedby');
  });

  it('explains A and NS with their D5 meaning', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark onMark={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Ausente' })).toHaveAttribute('title', 'Ausente: avisó fuera de plazo');
    expect(screen.getByRole('button', { name: 'No show' })).toHaveAttribute('title', 'No show: no avisó');
  });

  it('says an expired booking expired instead of claiming the client cancelled', () => {
    render(
      <RosterTable
        rows={[
          row({ bookingId: 'b1', status: 'expired', cancelledAt: '2026-10-12T00:14:00.000Z' }),
          row({ bookingId: 'b2', client: { id: 'r', name: 'Rodrigo Silva' }, status: 'cancelled', cancelledAt: '2026-10-12T00:14:00.000Z' }),
        ]}
        canMark
        onMark={vi.fn()}
      />,
    );
    const expired = screen.getByRole('row', { name: /Martina Suárez/ });
    expect(within(expired).getByText('Expiró 11/10 — 21:14')).toBeInTheDocument();
    expect(within(expired).getByText('Expirada')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Rodrigo Silva/ })).getByText('Canceló 11/10 — 21:14')).toBeInTheDocument();
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

describe('RosterTable on mobile', () => {
  it('stacks each booking as a card so the attendance and cancel buttons need no horizontal swipe', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark onMark={vi.fn()} onCancel={vi.fn()} />);
    const first = screen.getByRole('row', { name: /Martina Suárez/ });
    expect(first).toHaveClass('max-xl:grid');
    expect(first.closest('table')).toHaveClass('max-xl:block');
    expect(screen.getByRole('columnheader', { name: 'Registrar' }).closest('thead')).toHaveClass('max-xl:sr-only');
    const actions = within(first).getByRole('button', { name: 'Presente' }).closest('td');
    expect(actions).toHaveClass('max-xl:col-span-2');
    expect(within(first).getByRole('button', { name: 'Cancelar reserva de Martina Suárez' }).closest('td')).toBe(actions);
  });

  it('labels the cells whose header is hidden on mobile', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark onMark={vi.fn()} />);
    const cells = Array.from(screen.getByRole('row', { name: /Martina Suárez/ }).querySelectorAll('td'));
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([null, 'Plan', 'Última asistencia', null, null]);
  });
});

describe('RosterTable button hover tints', () => {
  const GHOST_HOVER = ['hover:bg-muted', 'hover:text-foreground', 'dark:hover:bg-muted/50'];

  it.each([
    ['present', 'Presente', 'success'],
    ['absent', 'Ausente', 'danger'],
    ['no_show', 'No show', 'danger'],
  ] as const)('keeps the %s tint on hover, in light and dark, when it is the active attendance', (attendance, name, tone) => {
    render(<RosterTable rows={[row({ bookingId: 'b1', attendance })]} canMark onMark={vi.fn()} />);
    const button = screen.getByRole('button', { name });
    expect(button).toHaveClass(`bg-${tone}-muted`, `text-${tone}`, `hover:bg-${tone}-muted`, `hover:text-${tone}`, `dark:hover:bg-${tone}-muted`);
    for (const ghost of GHOST_HOVER) expect(button).not.toHaveClass(ghost);
  });

  it('tints an inactive attendance button on hover in dark too, only while marking is allowed', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark onMark={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Presente' })).toHaveClass('hover:bg-success-muted', 'dark:hover:bg-success-muted');
    expect(screen.getByRole('button', { name: 'Ausente' })).toHaveClass('hover:bg-danger-muted', 'dark:hover:bg-danger-muted');
    expect(screen.getByRole('button', { name: 'No show' })).toHaveClass('hover:bg-danger-muted', 'dark:hover:bg-danger-muted');
  });

  it('does not tint the attendance buttons on hover while marking is not allowed', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark={false} onMark={vi.fn()} />);
    for (const name of ['Presente', 'Ausente', 'No show']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).not.toMatch(/hover:bg-(success|danger)-muted/);
    }
  });

  it('keeps the cancel button transparent on hover in dark too, turning only its text red', () => {
    render(<RosterTable rows={[row({ bookingId: 'b1' })]} canMark onMark={vi.fn()} onCancel={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: 'Cancelar reserva de Martina Suárez' });
    expect(cancel).toHaveClass('hover:bg-transparent', 'dark:hover:bg-transparent', 'hover:text-danger');
    for (const ghost of GHOST_HOVER) expect(cancel).not.toHaveClass(ghost);
  });
});

describe('RosterTable semantics below md', () => {
  const renderRows = () =>
    render(<RosterTable rows={[row({ bookingId: 'b1' }), row({ bookingId: 'b2', client: { id: 'r', name: 'Rodrigo Silva' } })]} canMark onMark={vi.fn()} />);

  it('spells the table roles so they survive display block/grid', () => {
    renderRows();
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('role', 'table');
    expect(screen.getAllByRole('rowgroup')).toHaveLength(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Alumno',
      'Plan',
      'Última asistencia',
      'Estado',
      'Registrar',
    ]);
    for (const element of table.querySelectorAll('thead, tbody, tr, th, td')) expect(element).toHaveAttribute('role');
  });

  it('labels the student and status cells for assistive technology', () => {
    renderRows();
    const first = screen.getAllByRole('row')[1];
    expect(within(first).getByRole('cell', { name: /^Alumno:\s*Martina Suárez$/ })).toBeInTheDocument();
    expect(within(first).getByRole('cell', { name: /^Estado:\s*Pendiente$/ })).toBeInTheDocument();
  });

  it('shows the cells in the same order on mobile as in the DOM', () => {
    renderRows();
    const cells = Array.from(screen.getAllByRole('row')[1].querySelectorAll('td'));
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([null, 'Plan', 'Última asistencia', null, null]);
    for (const cell of cells) expect(cell.className).not.toMatch(/max-xl:(order|row-start|col-start)/);
  });
});
