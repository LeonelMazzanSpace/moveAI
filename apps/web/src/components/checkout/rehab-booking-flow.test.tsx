import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MeDto, PlanDto, PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';
import { businessTodayWeb } from '@/lib/format';

const apiFetch = vi.fn();
const assign = vi.fn();

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/rehab' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.stubGlobal('location', { assign });

const { RehabBookingFlow } = await import('./rehab-booking-flow');

const plan: PlanDto = {
  id: 'plan-eval', service: 'rehab', kind: 'evaluation', slug: 'rehab-evaluacion', name: 'Evaluación y Diagnóstico',
  description: '', features: [], price: 1800, currency: 'UYU', periodMonths: null, periodDays: null,
  sessionsIncluded: null, durationMinutes: 60, featured: false, active: true, sortOrder: 1, autoDebitEnabled: false,
};
const settings: PublicSettingsDto = { cancelLimitHours: 2, bookingWindowDays: 14 };
const today = businessTodayWeb();
const slot: TimeSlotDto = {
  id: 'slot-1', service: 'rehab', startsAt: `${today}T14:00:00.000Z`, endsAt: `${today}T15:00:00.000Z`, capacity: 1,
  booked: 0, available: 1, isFull: false, professional: { id: 'p1', name: 'Dra. Gómez' }, bookedByMe: false,
};
const guest = { name: 'Ana Pérez', email: 'ana@mail.com', phone: '099123456' };

const client: MeDto = { id: 'u1', name: 'Ana Pérez', email: 'ana@mail.com', role: 'client', phone: null, rehabFollowupEnabled: false };

function mockApi(checkout: () => unknown, me: () => unknown = () => {
  throw new ApiError(401, 'UNAUTHENTICATED', 'x');
}) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/me') return me();
    if (path === '/settings/public') return settings;
    if (path === '/schedule/availability') return [{ date: today, available: 1 }];
    if (path === '/schedule/time-slots') return [slot];
    if (path === '/checkout/booking' && init?.method === 'POST') return checkout();
    throw new Error(`unexpected request ${path}`);
  });
}

function renderFlow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RehabBookingFlow plan={plan} />
    </QueryClientProvider>,
  );
  return queryClient;
}

async function pickSlot() {
  await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
  await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
}

async function fillGuestAndPay() {
  await pickSlot();
  await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }));
  await userEvent.type(await screen.findByLabelText('Nombre'), guest.name);
  await userEvent.type(screen.getByLabelText('Email'), guest.email);
  await userEvent.type(screen.getByLabelText('Teléfono'), guest.phone);
  await userEvent.click(screen.getByRole('button', { name: 'Ir a pagar' }));
}

describe('RehabBookingFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('books as a guest and redirects to the payment page', async () => {
    mockApi(() => ({ purchaseId: 'p', externalReference: 'ref', initPoint: 'https://mp.test/pay', bookingId: 'b', holdExpiresAt: null }));
    renderFlow();

    await fillGuestAndPay();

    await vi.waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/checkout/booking', {
        method: 'POST',
        body: { planId: 'plan-eval', timeSlotId: 'slot-1', guest },
      }),
    );
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'));
  });

  it('asks existing accounts to sign in', async () => {
    mockApi(() => {
      throw new ApiError(409, 'LOGIN_REQUIRED', 'Ya tenés una cuenta con ese email: ingresá para continuar.');
    });
    renderFlow();

    await fillGuestAndPay();

    expect(await screen.findByText('Ya tenés una cuenta con ese email: ingresá para continuar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar?next=%2Frehab');
    expect(assign).not.toHaveBeenCalled();
  });

  it('refreshes the slots when the slot is already full', async () => {
    mockApi(() => {
      throw new ApiError(409, 'SLOT_FULL', 'El turno está completo.');
    });
    renderFlow();

    await fillGuestAndPay();

    expect(await screen.findByText('El turno está completo.')).toBeInTheDocument();
    const slotCalls = () => apiFetch.mock.calls.filter(([path]) => path === '/schedule/time-slots').length;
    await vi.waitFor(() => expect(slotCalls()).toBeGreaterThan(1));
  });

  it('books with the session and without guest data when the client is signed in', async () => {
    mockApi(() => ({ purchaseId: 'p', externalReference: 'ref', initPoint: 'https://mp.test/pay', bookingId: 'b', holdExpiresAt: null }), () => client);
    renderFlow();

    await pickSlot();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'));
    const post = apiFetch.mock.calls.find(([path]) => path === '/checkout/booking');
    expect(post?.[1]).toEqual({ method: 'POST', body: { planId: 'plan-eval', timeSlotId: 'slot-1' } });
    expect(post?.[1].body).not.toHaveProperty('guest');
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeDisabled();
  });

  it('shows the error with retry instead of the guest form when /me fails for a reason other than 401', async () => {
    let failing = true;
    mockApi(() => ({ purchaseId: 'p', externalReference: 'ref', initPoint: 'https://mp.test/pay', bookingId: 'b', holdExpiresAt: null }), () => {
      if (failing) throw new ApiError(500, 'INTERNAL_ERROR', 'x');
      return client;
    });
    renderFlow();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    expect(screen.queryByLabelText('Nombre')).toBeNull();

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Continuar al pago' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the flow visible when a background refresh of /me fails for a signed-in client', async () => {
    let failing = false;
    mockApi(() => ({ purchaseId: 'p', externalReference: 'ref', initPoint: 'https://mp.test/pay', bookingId: 'b', holdExpiresAt: null }), () => {
      if (failing) throw new ApiError(500, 'INTERNAL_ERROR', 'x');
      return client;
    });
    const queryClient = renderFlow();

    await pickSlot();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled());

    failing = true;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      // TanStack Query avisa a React con un `setTimeout(0)`: sin este turno el DOM todavía no refleja el error.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(queryClient.getQueryState(['me'])?.status).toBe('error');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeEnabled();
  });

  it('keeps the guest data after the slot turned out to be full', async () => {
    mockApi(() => {
      throw new ApiError(409, 'SLOT_FULL', 'El turno está completo.');
    });
    renderFlow();

    await fillGuestAndPay();

    expect(await screen.findByText('El turno está completo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue(guest.name);
    expect(screen.getByLabelText('Email')).toHaveValue(guest.email);
    expect(screen.getByLabelText('Teléfono')).toHaveValue(guest.phone);
    expect(screen.getByRole('button', { name: 'Ir a pagar' })).toBeDisabled();
  });

  it('lets the guest pay again after choosing another slot without retyping the data', async () => {
    let attempts = 0;
    mockApi(() => {
      attempts += 1;
      if (attempts === 1) throw new ApiError(409, 'SLOT_FULL', 'El turno está completo.');
      return { purchaseId: 'p', externalReference: 'ref', initPoint: 'https://mp.test/pay', bookingId: 'b', holdExpiresAt: null };
    });
    renderFlow();

    await fillGuestAndPay();
    await screen.findByText('El turno está completo.');
    await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ir a pagar' }));

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'));
    expect(apiFetch).toHaveBeenCalledWith('/checkout/booking', {
      method: 'POST',
      body: { planId: 'plan-eval', timeSlotId: 'slot-1', guest },
    });
  });
});
