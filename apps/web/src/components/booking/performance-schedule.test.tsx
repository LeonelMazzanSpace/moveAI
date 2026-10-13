import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';

const apiFetch = vi.fn();
const push = vi.fn();

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/performance' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { PerformanceSchedule } = await import('./performance-schedule');

const settings: PublicSettingsDto = { cancelLimitHours: 2, bookingWindowDays: 14 };
const slots: TimeSlotDto[] = [
  {
    id: 'slot-19', service: 'performance', startsAt: '2026-10-12T22:00:00.000Z', endsAt: '2026-10-12T23:00:00.000Z',
    capacity: 14, booked: 13, available: 1, isFull: false, professional: null, bookedByMe: false,
  },
];

function mockApi(bookingError: ApiError) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/settings/public') return settings;
    if (path === '/schedule/time-slots') return slots;
    if (path === '/bookings' && init?.method === 'POST') throw bookingError;
    throw new Error(`unexpected request ${path}`);
  });
}

function renderSchedule() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PerformanceSchedule />
    </QueryClientProvider>,
  );
}

describe('PerformanceSchedule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the day slots with their capacity and the day selector', async () => {
    mockApi(new ApiError(403, 'PLAN_REQUIRED', 'x'));
    renderSchedule();

    expect(await screen.findByText('13 / 14 cupos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Horarios y cupos.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Día')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(settings.bookingWindowDays + 1);
  });

  it('offers to renew when the plan is not valid', async () => {
    mockApi(new ApiError(403, 'PLAN_REQUIRED', 'Necesitás un plan vigente para reservar.'));
    renderSchedule();

    await userEvent.click(await screen.findByRole('button', { name: 'Reservar' }));

    const renew = await screen.findByRole('link', { name: 'Renovar plan' });
    expect(renew).toHaveAttribute('href', '/planes?service=performance');
  });

  it('sends anonymous visitors to the login', async () => {
    mockApi(new ApiError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión.'));
    renderSchedule();

    await userEvent.click(await screen.findByRole('button', { name: 'Reservar' }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/ingresar?next=%2Fperformance'));
  });
});
