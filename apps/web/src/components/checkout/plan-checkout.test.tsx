import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AutoDebitDto, MySubscriptionsDto, PlanDto, SubscriptionDto } from '@/lib/api/types';

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
    autoDebitEnabled: false, ...overrides,
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
    if (path === '/me/auto-debits') return [];
    if (path === '/checkout/plan' && init?.method === 'POST') return checkout();
    throw new Error(`unexpected request ${path}`);
  });
}

function renderCheckout(slug = 'performance-trimestral') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <PlanCheckout slug={slug} />
    </QueryClientProvider>,
  );
  /** Espera a que las suscripciones terminen de cargar: sin eso, "no aparece el aviso" también se cumple mientras carga. */
  const subscriptionsSettled = () =>
    vi.waitFor(() => expect(queryClient.getQueryState(['me', 'subscriptions'])?.fetchStatus).toBe('idle'));
  return { subscriptionsSettled, queryClient, ...view };
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
    const first = renderCheckout();
    await screen.findByText('Plan Trimestral');
    await first.subscriptionsSettled();
    expect(screen.queryByText(/Tu nuevo período empieza/)).toBeNull();
    first.unmount();

    mockApi(pack, { ...noSubscriptions, performance: subscription });
    const second = renderCheckout('recovery-paquete-4');
    await screen.findByText('Paquete 4 sesiones');
    await second.subscriptionsSettled();
    expect(screen.queryByText(/Tu nuevo período empieza/)).toBeNull();
  });

  it.each(['evaluation', 'single_session'] as const)('refuses to sell a %s plan here', async (kind) => {
    mockApi(makePlan({ kind }));
    renderCheckout();

    expect(await screen.findByText('Plan no disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', '/planes');
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
  });

  it('gives the standalone "Ver planes" link a 32 px tap area', async () => {
    mockApi(new ApiError(404, 'PLAN_NOT_FOUND', 'El plan no existe.'));
    renderCheckout('no-existe');

    expect(await screen.findByRole('link', { name: 'Ver planes' })).toHaveClass('inline-flex', 'min-h-8', 'items-center');
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

const debitPlan = makePlan({ autoDebitEnabled: true });
const debitPack = makePlan({ ...pack, autoDebitEnabled: true });
const debitResponse = { externalReference: 'deb-1', initPoint: 'https://mp.test/debit' };

function autoDebit(over: Partial<AutoDebitDto> = {}): AutoDebitDto {
  return {
    id: 'd1', planId: 'plan-1', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance', status: 'authorized',
    amount: 3900, frequency: 1, frequencyType: 'months', nextChargeDate: '2026-11-15', createdAt: '2026-10-14T12:00:00.000Z',
    cancelledAt: null, cancelReason: null, ...over,
  };
}

function mockDebitApi(
  plan: PlanDto,
  { debits = [] as AutoDebitDto[] | ApiError, subscriptions = noSubscriptions, start = (): unknown => debitResponse } = {},
) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path.startsWith('/catalog/plans/')) return plan;
    if (path === '/me/subscriptions') return subscriptions;
    if (path === '/me/auto-debits') {
      if (debits instanceof ApiError) throw debits;
      return debits;
    }
    if (path === '/checkout/auto-debit' && init?.method === 'POST') return start();
    if (path === '/checkout/plan' && init?.method === 'POST') return checkoutResponse;
    throw new Error(`unexpected request ${path}`);
  });
}

/** El botón arranca deshabilitado mientras se cargan los débitos: se espera a que se habilite. */
const payButtonEnabled = () =>
  vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeEnabled());
const debitRadio = () => screen.getByRole('radio', { name: 'Débito automático' });
const onceRadio = () => screen.getByRole('radio', { name: 'Pago único' });
const ACTIVE_NOTICE = 'Ya tenés débito automático activo para Performance.';

describe('PlanCheckout automatic debit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers the payment mode only when the plan allows automatic debit', async () => {
    mockDebitApi(makePlan({ autoDebitEnabled: false }));
    renderCheckout();

    await screen.findByRole('button', { name: 'Pagar con Mercado Pago' });
    await payButtonEnabled();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('checks the debits of every Performance plan, even one that does not allow debit', async () => {
    mockDebitApi(makePlan({ autoDebitEnabled: false }));
    renderCheckout();

    await payButtonEnabled();
    expect(apiFetch).toHaveBeenCalledWith('/me/auto-debits');
  });

  it('does not check the debits for a Recovery plan that does not allow debit, and does not delay its button', async () => {
    mockDebitApi(makePlan({ ...pack, autoDebitEnabled: false }));
    renderCheckout('recovery-paquete-4');

    expect(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' })).toBeEnabled();
    expect(apiFetch).not.toHaveBeenCalledWith('/me/auto-debits');
  });

  it('blocks a Performance plan that does not allow debit while a Performance debit is authorized', async () => {
    mockDebitApi(makePlan({ autoDebitEnabled: false }), { debits: [autoDebit()] });
    renderCheckout();

    expect(await screen.findByText(ACTIVE_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps the button of a Performance plan without debit disabled until the debits are known', async () => {
    let release: (value: AutoDebitDto[]) => void = () => undefined;
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/catalog/plans/')) return makePlan({ autoDebitEnabled: false });
      if (path === '/me/subscriptions') return noSubscriptions;
      if (path === '/me/auto-debits') return new Promise<AutoDebitDto[]>((resolve) => (release = resolve));
      throw new Error(`unexpected request ${path}`);
    });
    renderCheckout();

    expect(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' })).toBeDisabled();
    release([autoDebit()]);
    expect(await screen.findByText(ACTIVE_NOTICE)).toBeInTheDocument();
  });

  it('does not delay the button of a Recovery plan that allows debit while the debits load', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/catalog/plans/')) return debitPack;
      if (path === '/me/subscriptions') return noSubscriptions;
      if (path === '/me/auto-debits') return new Promise(() => undefined);
      throw new Error(`unexpected request ${path}`);
    });
    renderCheckout('recovery-paquete-4');

    expect(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' })).toBeEnabled();
  });

  it('shows "Pago único" selected by default next to "Débito automático"', async () => {
    mockDebitApi(debitPlan);
    renderCheckout();

    expect(await screen.findByRole('radio', { name: 'Débito automático' })).not.toBeChecked();
    expect(onceRadio()).toBeChecked();
    await payButtonEnabled();
    expect(screen.queryByRole('button', { name: 'Activar débito automático' })).toBeNull();
  });

  it('explains how often the debit is charged, per month for plans and per day for packs', async () => {
    mockDebitApi(debitPlan);
    const first = renderCheckout();
    expect(
      await screen.findByText('Se cobra automáticamente cada 3 meses con Mercado Pago. Podés cancelarlo cuando quieras desde tu perfil.'),
    ).toBeInTheDocument();
    first.unmount();

    mockDebitApi(makePlan({ autoDebitEnabled: true, periodMonths: 1 }));
    const second = renderCheckout();
    expect(
      await screen.findByText('Se cobra automáticamente cada mes con Mercado Pago. Podés cancelarlo cuando quieras desde tu perfil.'),
    ).toBeInTheDocument();
    second.unmount();

    mockDebitApi(debitPack);
    renderCheckout('recovery-paquete-4');
    expect(
      await screen.findByText('Se cobra automáticamente cada 30 días con Mercado Pago. Podés cancelarlo cuando quieras desde tu perfil.'),
    ).toBeInTheDocument();
  });

  it('says when the first charge happens if a Performance period is still running', async () => {
    mockDebitApi(debitPlan, { subscriptions: { ...noSubscriptions, performance: subscription } });
    renderCheckout();

    expect(await screen.findByText('El primer cobro es el 01/11/2026, cuando termina tu plan actual.')).toBeInTheDocument();
  });

  it('does not mention a delayed first charge without a running period, after an expired one or for packs', async () => {
    mockDebitApi(debitPlan);
    const none = renderCheckout();
    await screen.findByRole('radio', { name: 'Débito automático' });
    await none.subscriptionsSettled();
    expect(screen.queryByText(/El primer cobro es el/)).toBeNull();
    none.unmount();

    mockDebitApi(debitPlan, { subscriptions: { ...noSubscriptions, performance: { ...subscription, status: 'expired' } } });
    const expired = renderCheckout();
    await screen.findByRole('radio', { name: 'Débito automático' });
    await expired.subscriptionsSettled();
    expect(screen.queryByText(/El primer cobro es el/)).toBeNull();
    expired.unmount();

    mockDebitApi(debitPack, { subscriptions: { ...noSubscriptions, performance: subscription } });
    const packView = renderCheckout('recovery-paquete-4');
    await screen.findByRole('radio', { name: 'Débito automático' });
    await packView.subscriptionsSettled();
    expect(screen.queryByText(/El primer cobro es el/)).toBeNull();
  });

  it('starts the debit with the plan slug and redirects to Mercado Pago without allowing a second click', async () => {
    mockDebitApi(debitPlan);
    renderCheckout();

    await userEvent.click(await screen.findByRole('radio', { name: 'Débito automático' }));
    expect(debitRadio()).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Activar débito automático' }));

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/debit'));
    expect(apiFetch).toHaveBeenCalledWith('/checkout/auto-debit', { method: 'POST', body: { planSlug: 'performance-trimestral' } });
    expect(apiFetch).not.toHaveBeenCalledWith('/checkout/plan', expect.anything());
    expect(screen.getByRole('button', { name: 'Activar débito automático' })).toBeDisabled();
  });

  it('names the group "Forma de pago" and links the debit explanation to its radio', async () => {
    mockDebitApi(debitPlan);
    renderCheckout();

    expect(await screen.findByRole('group', { name: 'Forma de pago' })).toContainElement(debitRadio());
    expect(debitRadio()).toHaveAccessibleDescription(
      'Se cobra automáticamente cada 3 meses con Mercado Pago. Podés cancelarlo cuando quieras desde tu perfil.',
    );
    expect(onceRadio()).not.toHaveAttribute('aria-describedby');
  });

  it('includes the date of the first charge in the description of the debit radio', async () => {
    mockDebitApi(debitPlan, { subscriptions: { ...noSubscriptions, performance: subscription } });
    renderCheckout();

    await screen.findByText('El primer cobro es el 01/11/2026, cuando termina tu plan actual.');
    expect(debitRadio()).toHaveAccessibleDescription(
      'Se cobra automáticamente cada 3 meses con Mercado Pago. Podés cancelarlo cuando quieras desde tu perfil. El primer cobro es el 01/11/2026, cuando termina tu plan actual.',
    );
  });

  it('does not let the client switch the payment mode while a one-time checkout is in flight, so a second one cannot start', async () => {
    let release: (value: unknown) => void = () => undefined;
    mockDebitApi(debitPlan);
    renderCheckout();
    await payButtonEnabled();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/checkout/plan') return new Promise((resolve) => (release = resolve));
      throw new Error(`unexpected request ${path}`);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }));

    expect(debitRadio()).toBeDisabled();
    expect(onceRadio()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeDisabled();
    await userEvent.click(debitRadio());
    expect(onceRadio()).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Activar débito automático' })).toBeNull();
    expect(apiFetch).not.toHaveBeenCalledWith('/checkout/auto-debit', expect.anything());

    release(checkoutResponse);
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'));
    expect(debitRadio()).toBeDisabled();
    expect(onceRadio()).toBeDisabled();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('does not let the client switch back to a one-time payment while the debit is being created', async () => {
    let release: (value: unknown) => void = () => undefined;
    mockDebitApi(debitPlan, { start: () => new Promise((resolve) => (release = resolve)) });
    renderCheckout();

    await userEvent.click(await screen.findByRole('radio', { name: 'Débito automático' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activar débito automático' }));

    expect(onceRadio()).toBeDisabled();
    expect(debitRadio()).toBeDisabled();
    await userEvent.click(onceRadio());
    expect(debitRadio()).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
    expect(apiFetch).not.toHaveBeenCalledWith('/checkout/plan', expect.anything());

    release(debitResponse);
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/debit'));
    expect(onceRadio()).toBeDisabled();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('lets the client change the payment mode again after a failed attempt', async () => {
    mockDebitApi(debitPlan, {
      start: () => {
        throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'x');
      },
    });
    renderCheckout();

    await userEvent.click(await screen.findByRole('radio', { name: 'Débito automático' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activar débito automático' }));
    await screen.findByRole('alert');

    expect(onceRadio()).toBeEnabled();
    await userEvent.click(onceRadio());
    expect(onceRadio()).toBeChecked();
  });

  it('keeps charging a one-time payment through the regular checkout when "Pago único" is chosen', async () => {
    mockDebitApi(debitPlan);
    renderCheckout();

    await userEvent.click(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' }));

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'));
    expect(apiFetch).not.toHaveBeenCalledWith('/checkout/auto-debit', expect.anything());
  });

  it('shows the API error of the debit inline and lets the client try again', async () => {
    mockDebitApi(debitPlan, {
      start: () => {
        throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'x');
      },
    });
    renderCheckout();

    await userEvent.click(await screen.findByRole('radio', { name: 'Débito automático' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activar débito automático' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos iniciar el pago. Probá de nuevo en unos minutos.');
    expect(screen.getByRole('button', { name: 'Activar débito automático' })).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('blocks buying Performance while an automatic debit of Performance is authorized', async () => {
    mockDebitApi(debitPlan, { debits: [autoDebit()] });
    renderCheckout();

    expect(await screen.findByText(ACTIVE_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Activar débito automático' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it.each([
    ['pending', autoDebit({ status: 'pending' })],
    ['cancelled', autoDebit({ status: 'cancelled', cancelledAt: '2026-10-15T12:00:00.000Z', cancelReason: 'client' })],
    ['recovery', autoDebit({ id: 'd2', service: 'recovery', planSlug: 'recovery-paquete-4' })],
  ])('does not block Performance for a %s debit that is not an active Performance one', async (_label, debit) => {
    mockDebitApi(debitPlan, { debits: [debit] });
    const view = renderCheckout();

    await screen.findByRole('button', { name: 'Pagar con Mercado Pago' });
    await payButtonEnabled();
    await vi.waitFor(() => expect(view.queryClient.getQueryState(['me', 'auto-debits'])?.fetchStatus).toBe('idle'));
    expect(screen.queryByText(ACTIVE_NOTICE)).toBeNull();
  });

  it('keeps the Performance button disabled until the debits are known', async () => {
    let release: (value: AutoDebitDto[]) => void = () => undefined;
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/catalog/plans/')) return debitPlan;
      if (path === '/me/subscriptions') return noSubscriptions;
      if (path === '/me/auto-debits') return new Promise<AutoDebitDto[]>((resolve) => (release = resolve));
      throw new Error(`unexpected request ${path}`);
    });
    renderCheckout();

    expect(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' })).toBeDisabled();
    release([]);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeEnabled());
  });

  it('still lets the client buy when the debits cannot be loaded', async () => {
    mockDebitApi(debitPlan, { debits: new ApiError(500, 'INTERNAL_ERROR', 'x') });
    renderCheckout();

    await screen.findByRole('button', { name: 'Pagar con Mercado Pago' });
    await payButtonEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not block a Recovery pack because of an authorized Recovery debit', async () => {
    mockDebitApi(debitPack, { debits: [autoDebit({ id: 'd2', service: 'recovery', planSlug: 'recovery-paquete-4' })] });
    renderCheckout('recovery-paquete-4');

    await screen.findByRole('button', { name: 'Pagar con Mercado Pago' });
    await payButtonEnabled();
    expect(screen.queryByText(/Ya tenés débito automático activo/)).toBeNull();
  });

  it('shows the same notice when the server answers AUTO_DEBIT_ACTIVE for Performance', async () => {
    mockDebitApi(debitPlan, {
      start: () => {
        throw new ApiError(409, 'AUTO_DEBIT_ACTIVE', 'x');
      },
    });
    renderCheckout();

    await userEvent.click(await screen.findByRole('radio', { name: 'Débito automático' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activar débito automático' }));

    expect(await screen.findByText(ACTIVE_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar débito automático' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull();
  });

  it('shows the generic message for AUTO_DEBIT_ACTIVE on a Recovery pack and keeps the buttons', async () => {
    mockDebitApi(debitPack, {
      start: () => {
        throw new ApiError(409, 'AUTO_DEBIT_ACTIVE', 'x');
      },
    });
    renderCheckout('recovery-paquete-4');

    await userEvent.click(await screen.findByRole('radio', { name: 'Débito automático' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activar débito automático' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tenés un débito automático activo para este servicio.');
    expect(screen.getByRole('button', { name: 'Activar débito automático' })).toBeEnabled();
  });
});
