import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityItemDto, Paginated } from '@/lib/api/types';
import { ActivityList } from './activity-list';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const items: ActivityItemDto[] = [
  { type: 'attendance', label: 'Asistencia — Performance 18:00', date: '2026-10-10T21:00:00.000Z', amount: null, service: 'performance' },
  { type: 'booking', label: 'Reserva — Recovery 19:30', date: '2026-10-07T22:30:00.000Z', amount: null, service: 'recovery' },
  { type: 'payment', label: 'Pago — Paquete Recovery 4 sesiones', date: '2026-10-01T15:00:00.000Z', amount: 3200, service: 'recovery' },
  { type: 'cancellation', label: 'Reserva cancelada — Performance 07:00', date: '2026-09-28T10:00:00.000Z', amount: null, service: 'performance' },
];

const page = (list: ActivityItemDto[]): Paginated<ActivityItemDto> => ({ items: list, total: list.length, page: 1, pageSize: 5 });

function renderList(props: Parameters<typeof ActivityList>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityList {...props} />
    </QueryClientProvider>,
  );
}

describe('ActivityList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue(page(items));
  });

  it('renders the four activity types with dates and payment amounts', async () => {
    renderList();
    expect(await screen.findByText('Asistencia — Performance 18:00')).toBeInTheDocument();
    expect(screen.getByText('10/10/2026')).toBeInTheDocument();
    expect(screen.getByText('07/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Pago — Paquete Recovery 4 sesiones · $ 3.200')).toBeInTheDocument();
    expect(screen.getByText('Reserva cancelada — Performance 07:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todo' })).toHaveAttribute('href', '/historial');
    expect(apiFetch).toHaveBeenCalledWith('/me/activity', { query: { type: 'all', page: 1, pageSize: 5 } });
  });

  it('requests payments when switching to the Pagos tab', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Asistencia — Performance 18:00');
    await user.click(screen.getByRole('tab', { name: 'Pagos' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith('/me/activity', { query: { type: 'payments', page: 1, pageSize: 5 } }),
    );
  });

  it('paginates in the full variant', async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({ items, total: 45, page: 1, pageSize: 20 });
    renderList({ variant: 'full' });
    await screen.findByText('Página 1 de 3');
    expect(screen.queryByRole('link', { name: 'Ver todo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith('/me/activity', { query: { type: 'all', page: 2, pageSize: 20 } }),
    );
  });

  it('shows an empty state without activity', async () => {
    apiFetch.mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByText('Todavía no tenés actividad')).toBeInTheDocument();
  });
});
