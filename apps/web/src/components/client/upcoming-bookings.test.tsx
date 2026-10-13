import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { BookingDto } from '@/lib/api/types';
import { UpcomingBookings } from './upcoming-bookings';

const { apiFetch, toast } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('sonner', () => ({ toast }));

const booking = (over: Partial<BookingDto>): BookingDto => ({
  id: 'b1', timeSlotId: 't1', service: 'performance', startsAt: '2026-10-12T21:00:00.000Z', endsAt: '2026-10-12T22:00:00.000Z',
  durationMinutes: 60, label: 'Entrenamiento semi personalizado', status: 'confirmed', source: 'plan', attendance: null,
  canCancel: true, cancelledAt: null, ...over,
});

const bookings = [
  booking({}),
  booking({ id: 'b2', service: 'rehab', source: 'payment', label: 'Evaluación y Diagnóstico · 60 min', canCancel: false, startsAt: '2026-10-14T14:00:00.000Z' }),
];

function renderList(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('UpcomingBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation((path: string) => (path === '/me/bookings' ? Promise.resolve(bookings) : Promise.resolve(bookings[0])));
  });

  it('offers cancel only for cancellable bookings', async () => {
    renderList(<UpcomingBookings />);
    expect(await screen.findByText('Performance — 18:00')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(1);
    expect(screen.getByText('Cancelación con MOVE')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/me/bookings', { query: { scope: 'upcoming' } });
  });

  it('confirms before cancelling and posts to the contract endpoint', async () => {
    const user = userEvent.setup();
    renderList(<UpcomingBookings />);
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('¿Cancelar la reserva del 12/10/2026 a las 18:00?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/bookings/b1/cancel', { method: 'POST' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Reserva cancelada'));
  });

  it('shows the contract message when the cancel window is closed', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) =>
      path === '/me/bookings'
        ? Promise.resolve(bookings)
        : Promise.reject(new ApiError(409, 'CANCEL_WINDOW_CLOSED', 'x')),
    );
    renderList(<UpcomingBookings />);
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ya pasó el plazo para cancelar este turno.'));
  });

  it('shows an empty state without bookings', async () => {
    apiFetch.mockResolvedValue([]);
    renderList(<UpcomingBookings />);
    expect(await screen.findByText('No tenés reservas próximas')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x')).mockResolvedValue(bookings);
    renderList(<UpcomingBookings />);
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Performance — 18:00')).toBeInTheDocument();
  });
});
