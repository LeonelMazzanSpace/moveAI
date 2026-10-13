import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUTTON_DANGER, BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/components/staff/form-primitives';
import { ApiError } from '@/lib/api/errors';
import type { RosterItemDto, StaffTimeSlotDto } from '@/lib/api/types';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

const { CancelBookingDialog, SlotActions } = await import('./slot-actions');

const SLOT: StaffTimeSlotDto = {
  id: 's1', service: 'performance', startsAt: '2026-10-12T22:00:00.000Z', endsAt: '2026-10-12T23:00:00.000Z', capacity: 14,
  professional: null, cancelledAt: null, booked: 12, present: 0, absent: 0, noShow: 0, cancelled: 0, pendingAttendance: 12,
};

const BOOKING: RosterItemDto = {
  bookingId: 'b1', client: { id: 'c1', name: 'Martina Suárez' }, planName: 'Trimestral', lastAttendanceOn: null,
  status: 'confirmed', attendance: null, cancelledAt: null,
};

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { invalidate };
}

const rejectWith = (code: ConstructorParameters<typeof ApiError>[1]) => {
  apiFetch.mockRejectedValue(new ApiError(409, code, 'x'));
};

async function openAction(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Acciones del turno' }));
  await userEvent.click(await screen.findByRole('menuitem', { name }));
  return within(await screen.findByRole('dialog'));
}

describe('SlotActions', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
  });

  describe('Editar cupo', () => {
    it('describes how many active bookings the slot has', async () => {
      renderWithClient(<SlotActions slot={SLOT} />);
      const dialog = await openAction('Editar cupo');
      expect(dialog.getByText('Turno de las 19:00. Tiene 12 reservas activas.')).toBeInTheDocument();
    });

    it('uses the singular when there is a single active booking', async () => {
      renderWithClient(<SlotActions slot={{ ...SLOT, booked: 1 }} />);
      const dialog = await openAction('Editar cupo');
      expect(dialog.getByText('Turno de las 19:00. Tiene 1 reserva activa.')).toBeInTheDocument();
    });

    it('shows the contract message inline for CAPACITY_BELOW_BOOKED and keeps the dialog open', async () => {
      rejectWith('CAPACITY_BELOW_BOOKED');
      renderWithClient(<SlotActions slot={SLOT} />);
      const dialog = await openAction('Editar cupo');
      const capacity = dialog.getByLabelText('Cupo');
      await userEvent.clear(capacity);
      await userEvent.type(capacity, '10');
      await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

      expect(await dialog.findByRole('alert')).toHaveTextContent('El cupo no puede ser menor a las reservas activas.');
      expect(apiFetch).toHaveBeenCalledWith('/staff/time-slots/s1', { method: 'PATCH', body: { capacity: 10 } });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('validates the capacity range before calling the API and links the error to the field', async () => {
      renderWithClient(<SlotActions slot={SLOT} />);
      const dialog = await openAction('Editar cupo');
      const capacity = dialog.getByLabelText('Cupo');
      await userEvent.clear(capacity);
      await userEvent.type(capacity, '101');
      await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

      const message = await dialog.findByText('El cupo máximo es 100.');
      expect(capacity).toHaveAttribute('aria-invalid', 'true');
      expect(capacity).toHaveAttribute('aria-describedby', message.id);
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('refreshes slots and rosters, confirms with a period and closes on success', async () => {
      apiFetch.mockResolvedValue(SLOT);
      const { invalidate } = renderWithClient(<SlotActions slot={SLOT} />);
      const dialog = await openAction('Editar cupo');
      await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Cupo actualizado.'));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff', 'time-slots'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff', 'roster'] });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  describe('Cancelar turno', () => {
    it('shows the contract message inline for SLOT_HAS_BOOKINGS and keeps the dialog open', async () => {
      rejectWith('SLOT_HAS_BOOKINGS');
      renderWithClient(<SlotActions slot={SLOT} />);
      const dialog = await openAction('Cancelar turno');
      await userEvent.click(dialog.getByRole('button', { name: 'Cancelar turno' }));

      expect(await dialog.findByRole('alert')).toHaveTextContent('El turno tiene reservas activas.');
      expect(apiFetch).toHaveBeenCalledWith('/staff/time-slots/s1/cancel', { method: 'POST' });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('cancels the slot, confirms with a period and closes', async () => {
      apiFetch.mockResolvedValue({ ...SLOT, cancelledAt: '2026-10-12T20:00:00.000Z' });
      renderWithClient(<SlotActions slot={{ ...SLOT, booked: 0 }} />);
      const dialog = await openAction('Cancelar turno');
      await userEvent.click(dialog.getByRole('button', { name: 'Cancelar turno' }));

      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Turno cancelado.'));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });
});

describe('CancelBookingDialog', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
  });

  it('renders nothing without a booking', () => {
    renderWithClient(<CancelBookingDialog booking={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the API error inline and does not close', async () => {
    rejectWith('BOOKING_NOT_CANCELLABLE');
    const onClose = vi.fn();
    renderWithClient(<CancelBookingDialog booking={BOOKING} onClose={onClose} />);
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar reserva' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('Esta reserva no se puede cancelar online.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels the booking, confirms with a period and closes', async () => {
    apiFetch.mockResolvedValue(BOOKING);
    const onClose = vi.fn();
    renderWithClient(<CancelBookingDialog booking={BOOKING} onClose={onClose} />);
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/Vas a cancelar la reserva de Martina Suárez/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith('/staff/bookings/b1/cancel', { method: 'POST' });
    expect(toastSuccess).toHaveBeenCalledWith('Reserva cancelada.');
  });
});

describe('staff dialog buttons', () => {
  const LETTERING = ['text-[10px]', 'font-semibold', 'uppercase', 'tracking-[0.2em]'];

  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('spells the danger and back buttons of "Cancelar reserva" in the MOVE style', async () => {
    renderWithClient(<CancelBookingDialog booking={BOOKING} onClose={vi.fn()} />);
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Cancelar reserva' })).toHaveClass(...BUTTON_DANGER.split(' '));
    expect(dialog.getByRole('button', { name: 'Volver' })).toHaveClass(...BUTTON_OUTLINE.split(' '));
  });

  it('uses the same danger button in "Cancelar turno" as in "Cancelar reserva"', async () => {
    renderWithClient(<SlotActions slot={SLOT} />);
    const dialog = await openAction('Cancelar turno');
    const confirm = dialog.getByRole('button', { name: 'Cancelar turno' });
    expect(confirm).toHaveClass(...BUTTON_DANGER.split(' '), ...LETTERING);
    expect(confirm).not.toHaveClass('text-sm');
  });

  it('spells the buttons of "Editar cupo" in the MOVE style too', async () => {
    renderWithClient(<SlotActions slot={SLOT} />);
    const dialog = await openAction('Editar cupo');
    expect(dialog.getByRole('button', { name: 'Guardar' })).toHaveClass(...BUTTON_PRIMARY.split(' '));
    expect(dialog.getByRole('button', { name: 'Volver' })).toHaveClass(...BUTTON_OUTLINE.split(' '));
  });
});
