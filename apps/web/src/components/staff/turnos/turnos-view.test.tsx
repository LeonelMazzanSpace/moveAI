import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { Paginated, RosterItemDto, StaffTimeSlotDto } from '@/lib/api/types';

const replace = vi.fn();
let search = 'fecha=2026-10-12&servicio=performance';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const { TurnosView } = await import('./turnos-view');

const slot = (over: Partial<StaffTimeSlotDto>): StaffTimeSlotDto => ({
  id: 's1', service: 'performance', startsAt: '2026-10-12T21:00:00.000Z', endsAt: '2026-10-12T22:00:00.000Z', capacity: 14,
  professional: null, cancelledAt: null, booked: 12, present: 8, absent: 1, noShow: 1, cancelled: 1, pendingAttendance: 2, ...over,
});

const SLOTS = [
  slot({ id: 's1', startsAt: '2026-10-12T21:00:00.000Z' }),
  slot({ id: 's2', startsAt: '2026-10-12T22:00:00.000Z', booked: 5, present: 0, absent: 0, noShow: 0, cancelled: 0, pendingAttendance: 5 }),
];

const roster = (rows: RosterItemDto[]): Paginated<RosterItemDto> => ({ items: rows, total: rows.length, page: 1, pageSize: 20 });
const MARTINA: RosterItemDto = {
  bookingId: 'b1', client: { id: 'c1', name: 'Martina Suárez' }, planName: 'Trimestral', lastAttendanceOn: '2026-10-10',
  status: 'confirmed', attendance: null, cancelledAt: null,
};

function mockApi(attendance?: () => Promise<unknown>) {
  apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    if (path === '/staff/time-slots') return Promise.resolve(SLOTS);
    if (path === '/staff/time-slots/pending-attendance') return Promise.resolve([SLOTS[1]]);
    if (path.endsWith('/roster')) return Promise.resolve(roster([MARTINA]));
    if (path.endsWith('/attendance') && init?.method === 'PUT' && attendance) return attendance();
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TurnosView />
    </QueryClientProvider>,
  );
}

describe('TurnosView', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    toastError.mockReset();
    search = 'fecha=2026-10-12&servicio=performance';
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T22:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('selects a slot chip through the URL and shows its numbers', async () => {
    mockApi();
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: '19:00' }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('turno=s2'));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('fecha=2026-10-12'));
    expect(await screen.findByRole('group', { name: 'Reservas' })).toHaveTextContent('12/14');
    expect(screen.getByRole('group', { name: 'Presentes' })).toHaveTextContent('8');
    expect(screen.getByRole('group', { name: 'Ausentes + No show' })).toHaveTextContent('Ausentes 1 · No show 1');
    expect(screen.getByRole('group', { name: 'Cancelaciones' })).toHaveTextContent('1');
  });

  it('reads the selected slot from the URL', async () => {
    search = 'fecha=2026-10-12&servicio=performance&turno=s2';
    mockApi();
    renderView();
    expect(await screen.findByRole('group', { name: 'Reservas' })).toHaveTextContent('5/14');
    expect(screen.getByText('Turno 19:00 — Performance')).toBeInTheDocument();
  });

  it('links the pending attendance banner to the slot', async () => {
    mockApi();
    renderView();
    expect(await screen.findByText('Hay 1 turno con asistencia pendiente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /19:00/ })).toHaveAttribute('href', expect.stringContaining('turno=s2'));
  });

  it('marks attendance optimistically and reverts with the contract message on error', async () => {
    let reject: (error: ApiError) => void = () => undefined;
    mockApi(() => new Promise((_, rej) => { reject = rej; }));
    renderView();
    const row = await screen.findByRole('row', { name: /Martina Suárez/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Presente' }));
    await waitFor(() => expect(within(screen.getByRole('row', { name: /Martina Suárez/ })).getByText('Presente')).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith('/staff/bookings/b1/attendance', { method: 'PUT', body: { status: 'present' } });
    expect(screen.getByRole('group', { name: 'Presentes' })).toHaveTextContent('9');

    reject(new ApiError(409, 'ATTENDANCE_NOT_ALLOWED', 'x'));
    await waitFor(() => expect(within(screen.getByRole('row', { name: /Martina Suárez/ })).getByText('Pendiente')).toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith('Todavía no se puede registrar la asistencia de este turno.');
    expect(screen.getByRole('group', { name: 'Presentes' })).toHaveTextContent('8');
  });

  it('keeps attendance buttons disabled for future slots', async () => {
    search = 'fecha=2026-10-14&servicio=performance';
    apiFetch.mockImplementation((path: string) => {
      if (path === '/staff/time-slots') return Promise.resolve([slot({ id: 'f1', startsAt: '2026-10-14T21:00:00.000Z' })]);
      if (path === '/staff/time-slots/pending-attendance') return Promise.resolve([]);
      return Promise.resolve(roster([MARTINA]));
    });
    renderView();
    expect(await screen.findByRole('button', { name: 'Presente' })).toBeDisabled();
  });
});
