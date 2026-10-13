import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { PlanDto, PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';
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
  sessionsIncluded: null, durationMinutes: 60, featured: false, active: true, sortOrder: 1,
};
const settings: PublicSettingsDto = { cancelLimitHours: 2, bookingWindowDays: 14 };
const today = businessTodayWeb();
const slot: TimeSlotDto = {
  id: 'slot-1', service: 'rehab', startsAt: `${today}T14:00:00.000Z`, endsAt: `${today}T15:00:00.000Z`, capacity: 1,
  booked: 0, available: 1, isFull: false, professional: { id: 'p1', name: 'Dra. Gómez' }, bookedByMe: false,
};
const guest = { name: 'Ana Pérez', email: 'ana@mail.com', phone: '099123456' };

function mockApi(checkout: () => unknown) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/me') throw new ApiError(401, 'UNAUTHENTICATED', 'x');
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
}

async function fillGuestAndPay() {
  await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
  await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
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
});
