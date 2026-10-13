import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
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
  return queryClient;
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
    // Un visitante: el primer GET /me falla de inmediato; el segundo (el del flujo de pago al montarse) queda pendiente hasta que el test lo resuelve.
    let meCalls = 0;
    let rejectSecondMe: () => void = () => undefined;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') {
        meCalls += 1;
        if (meCalls > 1) await new Promise<void>((_, reject) => (rejectSecondMe = () => reject(new ApiError(401, 'UNAUTHENTICATED', 'x'))));
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

    // La segunda consulta de /me sigue en vuelo: el selector no se reemplaza por el esqueleto.
    expect(screen.getByRole('button', { name: 'Sesión individual' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '11:00' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeDisabled();
    await act(async () => rejectSecondMe());

    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Sesión individual' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '11:00' })).toBeInTheDocument();
  });

  it('takes a guest from the single session to the guest form', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') throw new ApiError(401, 'UNAUTHENTICATED', 'x');
      if (path === '/settings/public') return settings;
      if (path === '/schedule/availability') return [{ date: today, available: 3 }];
      if (path === '/schedule/time-slots') return [slot];
      throw new Error(`unexpected request ${path}`);
    });
    renderFlow();

    await userEvent.click(await screen.findByRole('button', { name: 'Sesión individual' }));
    await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
    await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    expect(await screen.findByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir a pagar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Continuar al pago' })).toBeNull();
  });

  it('keeps the chosen mode when a background refresh of /me fails for a signed-in client', async () => {
    let failing = false;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') {
        if (failing) throw new ApiError(500, 'INTERNAL_ERROR', 'x');
        return me;
      }
      if (path === '/me/subscriptions') return subscriptions(null);
      if (path === '/settings/public') return settings;
      if (path === '/schedule/availability') return [{ date: today, available: 3 }];
      if (path === '/schedule/time-slots') return [slot];
      throw new Error(`unexpected request ${path}`);
    });
    const queryClient = renderFlow();

    await userEvent.click(await screen.findByRole('button', { name: 'Sesión individual' }));
    await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
    await userEvent.click(await screen.findByRole('button', { name: '11:00' }));

    failing = true;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      // TanStack Query avisa a React con un `setTimeout(0)`: sin este turno el DOM todavía no refleja el error.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(queryClient.getQueryState(['me'])?.status).toBe('error');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sesión individual' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an error with retry instead of the options when the session cannot be checked', async () => {
    let failing = true;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') {
        if (failing) throw new ApiError(500, 'INTERNAL_ERROR', 'x');
        return me;
      }
      if (path === '/me/subscriptions') return subscriptions(null);
      throw new Error(`unexpected request ${path}`);
    });
    renderFlow();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    expect(screen.queryByRole('button', { name: 'Sesión individual' })).toBeNull();

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Sesión individual' })).toBeInTheDocument();
  });

  it('shows an error with retry when the subscriptions fail to load', async () => {
    let failing = true;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me') return me;
      if (path === '/me/subscriptions') {
        if (failing) throw new ApiError(500, 'INTERNAL_ERROR', 'x');
        return subscriptions(null);
      }
      throw new Error(`unexpected request ${path}`);
    });
    renderFlow();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    expect(screen.queryByRole('button', { name: 'Sesión individual' })).toBeNull();

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Sesión individual' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('prices the packs per package', async () => {
    mockApi(null);
    renderFlow();

    await userEvent.click(await screen.findByRole('button', { name: 'Paquete' }));
    expect(screen.getByText('/paquete')).toBeInTheDocument();
    expect(screen.queryByText('/mes')).toBeNull();
  });
});
