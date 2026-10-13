import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MySubscriptionsDto, PlanDto, SubscriptionDto } from '@/lib/api/types';

const apiFetch = vi.fn();
const assign = vi.fn();

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.stubGlobal('location', { assign });

const { PlanCheckout } = await import('./plan-checkout');

function makePlan(overrides: Partial<PlanDto>): PlanDto {
  return {
    id: 'plan-1', service: 'performance', kind: 'period_plan', slug: 'performance-trimestral', name: 'Plan Trimestral',
    description: '', features: ['Asistencias ilimitadas con reserva', 'Prioridad de horarios'], price: 10500, currency: 'UYU',
    periodMonths: 3, periodDays: null, sessionsIncluded: null, durationMinutes: null, featured: false, active: true, sortOrder: 1,
    ...overrides,
  };
}
const pack = makePlan({
  id: 'pack-4', service: 'recovery', kind: 'session_pack', slug: 'recovery-paquete-4', name: 'Paquete 4 sesiones', price: 3200,
  periodMonths: null, periodDays: 30, sessionsIncluded: 4, features: [],
});

const noSubscriptions: MySubscriptionsDto = { performance: null, upcomingPerformance: null, recoveryPacks: [] };
const subscription: SubscriptionDto = {
  id: 's1', planId: 'p0', planName: 'Plan Mensual', service: 'performance', startsOn: '2026-10-01', endsOn: '2026-10-31',
  status: 'active', daysLeft: 18, progressPct: 40,
};
const checkoutResponse = { purchaseId: 'p', externalReference: 'ref', initPoint: 'https://mp.test/pay', bookingId: null, holdExpiresAt: null };

function mockApi(plan: PlanDto | ApiError, subscriptions: MySubscriptionsDto = noSubscriptions, checkout: () => unknown = () => checkoutResponse) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path.startsWith('/catalog/plans/')) {
      if (plan instanceof ApiError) throw plan;
      return plan;
    }
    if (path === '/me/subscriptions') return subscriptions;
    if (path === '/checkout/plan' && init?.method === 'POST') return checkout();
    throw new Error(`unexpected request ${path}`);
  });
}

function renderCheckout(slug = 'performance-trimestral') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanCheckout slug={slug} />
    </QueryClientProvider>,
  );
}

describe('PlanCheckout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('summarizes the plan without the removed priority text', async () => {
    mockApi(makePlan({}));
    renderCheckout();

    expect(await screen.findByText('Plan Trimestral')).toBeInTheDocument();
    expect(screen.getByText('$ 10.500')).toBeInTheDocument();
    expect(screen.getByText('3 meses')).toBeInTheDocument();
    expect(screen.getByText('Asistencias ilimitadas con reserva')).toBeInTheDocument();
    expect(screen.queryByText(/prioridad de horarios/i)).toBeNull();
    expect(apiFetch).toHaveBeenCalledWith('/catalog/plans/performance-trimestral');
  });

  it('prices a session pack per package and states its validity', async () => {
    mockApi(pack);
    renderCheckout('recovery-paquete-4');

    expect(await screen.findByText('/paquete')).toBeInTheDocument();
    expect(screen.getByText('$ 3.200')).toBeInTheDocument();
    expect(screen.getByText('Vigencia del paquete')).toBeInTheDocument();
    expect(screen.getByText('30 días')).toBeInTheDocument();
    expect(screen.getByText('Las sesiones no usadas vencen al final del período.')).toBeInTheDocument();
  });

  it('does not add a unit to period plans', async () => {
    mockApi(makePlan({}));
    renderCheckout();

    await screen.findByText('Plan Trimestral');
    expect(screen.queryByText('/paquete')).toBeNull();
  });

  it('announces when a renewal starts after the current period', async () => {
    mockApi(makePlan({}), { ...noSubscriptions, performance: subscription });
    renderCheckout();

    expect(await screen.findByText('Tu nuevo período empieza el 01/11/2026')).toBeInTheDocument();
  });

  it('starts the renewal after the scheduled plan when there is one', async () => {
    const upcoming = { ...subscription, id: 's2', startsOn: '2026-11-01', endsOn: '2026-11-30', status: 'scheduled' as const };
    mockApi(makePlan({}), { ...noSubscriptions, performance: subscription, upcomingPerformance: upcoming });
    renderCheckout();

    expect(await screen.findByText('Tu nuevo período empieza el 01/12/2026')).toBeInTheDocument();
  });

  it('does not announce a renewal after an expired plan or for packs', async () => {
    mockApi(makePlan({}), { ...noSubscriptions, performance: { ...subscription, status: 'expired' } });
    const { unmount } = renderCheckout();
    await screen.findByText('Plan Trimestral');
    expect(screen.queryByText(/Tu nuevo período empieza/)).toBeNull();
    unmount();

    mockApi(pack, { ...noSubscriptions, performance: subscription });
    renderCheckout('recovery-paquete-4');
    await screen.findByText('Paquete 4 sesiones');
    expect(screen.queryByText(/Tu nuevo período empieza/)).toBeNull();
  });

  it.each(['evaluation', 'single_session'] as const)('refuses to sell a %s plan here', async (kind) => {
    mockApi(makePlan({ kind }));
    renderCheckout();

    expect(await screen.findByText('Plan no disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', '/planes');
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
  });

  it('shows the unavailable state when the plan does not exist', async () => {
    mockApi(new ApiError(404, 'PLAN_NOT_FOUND', 'El plan no existe.'));
    renderCheckout('no-existe');

    expect(await screen.findByText('Plan no disponible')).toBeInTheDocument();
  });

  it('shows an error with retry for other failures', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me/subscriptions') return noSubscriptions;
      throw new ApiError(500, 'INTERNAL_ERROR', 'x');
    });
    renderCheckout();

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByText('Plan no disponible')).toBeNull();
  });

  it('creates the checkout and redirects to Mercado Pago without allowing a second click', async () => {
    mockApi(makePlan({}));
    renderCheckout();

    await userEvent.click(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' }));

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'));
    expect(apiFetch).toHaveBeenCalledWith('/checkout/plan', { method: 'POST', body: { planId: 'plan-1' } });
    expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeDisabled();
  });

  it('shows the API error inline and lets the client try again', async () => {
    mockApi(makePlan({}), noSubscriptions, () => {
      throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'x');
    });
    renderCheckout();

    await userEvent.click(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos iniciar el pago. Probá de nuevo en unos minutos.');
    expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });
});
