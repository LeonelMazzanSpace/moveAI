import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MeDto, MySubscriptionsDto, PlanDto, PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';
import { businessTodayWeb } from '@/lib/format';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/recovery' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { RecoveryBookingFlow } = await import('./recovery-booking-flow');

function makePlan(overrides: Partial<PlanDto>): PlanDto {
  return {
    id: 'plan', service: 'recovery', kind: 'single_session', slug: 'recovery-sesion', name: 'Sesión individual',
    description: '', features: [], price: 900, currency: 'UYU', periodMonths: null, periodDays: null,
    sessionsIncluded: null, durationMinutes: 45, featured: false, active: true, sortOrder: 1, ...overrides,
  };
}
const plans = [
  makePlan({ id: 'plan-single' }),
  makePlan({ id: 'plan-4', kind: 'session_pack', slug: 'recovery-paquete-4', name: 'Paquete 4 sesiones', price: 3200, periodDays: 30, sessionsIncluded: 4 }),
];
const settings: PublicSettingsDto = { cancelLimitHours: 2, bookingWindowDays: 14 };
const today = businessTodayWeb();
const slot: TimeSlotDto = {
  id: 'slot-r1', service: 'recovery', startsAt: `${today}T14:00:00.000Z`, endsAt: `${today}T14:45:00.000Z`, capacity: 4,
  booked: 1, available: 3, isFull: false, professional: null, bookedByMe: false,
};
const me: MeDto = { id: 'u1', name: 'Ana', email: 'ana@mail.com', role: 'client', phone: null, rehabFollowupEnabled: false };

function subscriptions(sessionsLeft: number | null): MySubscriptionsDto {
  const packs =
    sessionsLeft === null
      ? []
      : [{ id: 'pack1', planId: 'plan-4', planName: 'Paquete 4 sesiones', startsOn: today, endsOn: today, sessionsTotal: 4, sessionsUsed: 4 - sessionsLeft, sessionsLeft }];
  return { performance: null, upcomingPerformance: null, recoveryPacks: packs };
}

function mockApi(sessionsLeft: number | null) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/me') return me;
    if (path === '/me/subscriptions') return subscriptions(sessionsLeft);
    if (path === '/settings/public') return settings;
    if (path === '/schedule/availability') return [{ date: today, available: 3 }];
    if (path === '/schedule/time-slots') return [slot];
    if (path === '/bookings' && init?.method === 'POST') return { id: 'b1' };
    throw new Error(`unexpected request ${path}`);
  });
}

function renderFlow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RecoveryBookingFlow plans={plans} />
    </QueryClientProvider>,
  );
}

describe('RecoveryBookingFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('books directly with the remaining sessions of a pack', async () => {
    mockApi(2);
    renderFlow();

    expect(await screen.findByText('Te quedan 2 sesiones')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
    await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await vi.waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/bookings', { method: 'POST', body: { timeSlotId: 'slot-r1' } }),
    );
  });

  it('offers a single session or a pack when there is no pack balance', async () => {
    mockApi(null);
    renderFlow();

    expect(await screen.findByRole('button', { name: 'Sesión individual' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Paquete' }));
    expect(screen.getByRole('link', { name: 'Contratar paquete' })).toHaveAttribute('href', '/checkout/plan/recovery-paquete-4');
  });

  it('does not require a session to browse the options', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') throw new ApiError(401, 'UNAUTHENTICATED', 'x');
      throw new Error(`unexpected request ${path}`);
    });
    renderFlow();

    expect(await screen.findByRole('button', { name: 'Paquete' })).toBeInTheDocument();
  });

  it('lets a guest pick a single session and keeps the date and slot picker open', async () => {
    // Un visitante: el primer GET /me falla de inmediato; el segundo (el del flujo de pago al montarse) tarda, como en la red real.
    let meCalls = 0;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') {
        meCalls += 1;
        if (meCalls > 1) await new Promise((resolve) => setTimeout(resolve, 50));
        throw new ApiError(401, 'UNAUTHENTICATED', 'x');
      }
      if (path === '/settings/public') return settings;
      if (path === '/schedule/availability') return [{ date: today, available: 3 }];
      if (path === '/schedule/time-slots') return [slot];
      throw new Error(`unexpected request ${path}`);
    });
    renderFlow();

    await userEvent.click(await screen.findByRole('button', { name: 'Sesión individual' }));
    await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
    await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
    await vi.waitFor(() => expect(meCalls).toBeGreaterThan(1));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(screen.getByRole('button', { name: 'Sesión individual' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '11:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled();
  });
});
