import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AutoDebitDto, MySubscriptionsDto } from '@/lib/api/types';
import { PacksSection } from './packs-card';
import { ClientPlanCard, ClientPlanSection } from './plan-card';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiFetch }));

describe('ClientPlanCard', () => {
  it('shows validity, days left and progress', () => {
    render(
      <ClientPlanCard
        subscription={{ id: 's', planId: 'p', planName: 'Plan Trimestral', service: 'performance', startsOn: '2026-08-15', endsOn: '2026-11-15', status: 'active', daysLeft: 34, progressPct: 63 }}
        upcoming={null}
      />,
    );
    expect(screen.getByText('Plan Trimestral — Performance')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText(/vence el/)).toHaveTextContent('15/11/2026');
    expect(screen.getByText('34 días restantes')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '63');
    expect(screen.getByRole('link', { name: 'Renovar plan' })).toHaveAttribute('href', '/planes?service=performance');
  });

  it('invites to buy without a plan', () => {
    render(<ClientPlanCard subscription={null} upcoming={null} />);
    expect(screen.getByText('Todavía no tenés un plan Performance')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', '/planes?service=performance');
  });

  it('labels each subscription status', () => {
    const base = { id: 's', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn: '2026-10-01', endsOn: '2026-10-31', daysLeft: 5, progressPct: 80 };
    const { rerender } = render(<ClientPlanCard subscription={{ ...base, status: 'expiring' }} upcoming={null} />);
    expect(screen.getByText('Por vencer')).toBeInTheDocument();
    rerender(<ClientPlanCard subscription={{ ...base, status: 'expired' }} upcoming={null} />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    rerender(<ClientPlanCard subscription={{ ...base, status: 'scheduled' }} upcoming={null} />);
    expect(screen.getByText('Programado')).toBeInTheDocument();
  });

  it('mentions the upcoming plan when there is one', () => {
    const current = { id: 's', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn: '2026-10-01', endsOn: '2026-10-31', status: 'expiring' as const, daysLeft: 5, progressPct: 80 };
    const next = { ...current, id: 's2', planName: 'Plan Trimestral', startsOn: '2026-11-01', endsOn: '2027-01-31', status: 'scheduled' as const };
    render(<ClientPlanCard subscription={current} upcoming={next} />);
    expect(screen.getByText(/Plan Trimestral/)).toHaveTextContent('01/11/2026');
  });

  it('announces a scheduled plan by its start date, without progress or days left', () => {
    const scheduled = { id: 's2', planId: 'p', planName: 'Plan Trimestral', service: 'performance' as const, startsOn: '2026-11-16', endsOn: '2027-02-15', status: 'scheduled' as const, daysLeft: 52, progressPct: 0 };
    render(<ClientPlanCard subscription={null} upcoming={scheduled} />);

    expect(screen.getByText('Programado')).toBeInTheDocument();
    expect(screen.getByText(/Comienza el/)).toHaveTextContent('Comienza el 16/11/2026 · vence el 15/02/2027');
    expect(screen.queryByText(/Vigente desde/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/restantes/)).toBeNull();
    expect(screen.queryByText('Progreso del período')).toBeNull();
  });

  it('keeps the progress of the current plan when another one is scheduled after it', () => {
    const current = { id: 's', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn: '2026-10-01', endsOn: '2026-10-31', status: 'active' as const, daysLeft: 5, progressPct: 80 };
    const next = { ...current, id: 's2', planName: 'Plan Trimestral', startsOn: '2026-11-01', endsOn: '2027-01-31', status: 'scheduled' as const };
    render(<ClientPlanCard subscription={current} upcoming={next} />);

    expect(screen.getByText(/Vigente desde/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByText('5 días restantes')).toBeInTheDocument();
  });
});

const subscriptions: MySubscriptionsDto = {
  performance: null,
  upcomingPerformance: null,
  recoveryPacks: [{ id: 'k1', planId: 'p', planName: 'Paquete 4 sesiones', startsOn: '2026-10-01', endsOn: '2026-10-31', sessionsTotal: 4, sessionsUsed: 1, sessionsLeft: 3 }],
};

/** Responde cada ruta del perfil por separado: las secciones también consultan `/me/auto-debits`. */
function mockProfile(data: MySubscriptionsDto = subscriptions, debits: AutoDebitDto[] = []) {
  apiFetch.mockImplementation(async (path: string) => {
    if (path === '/me/subscriptions') return data;
    if (path === '/me/auto-debits') return debits;
    throw new Error(`unexpected request ${path}`);
  });
}

function renderSections() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientPlanSection />
      <PacksSection />
    </QueryClientProvider>,
  );
}

describe('subscription sections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a single error block with one retry when the shared subscriptions request fails', async () => {
    apiFetch.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderSections();

    await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('recovers both sections with a single retry', async () => {
    const user = userEvent.setup();
    mockProfile();
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Paquete 4 sesiones')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tenés un plan Performance')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders both sections when the request succeeds', async () => {
    mockProfile();
    renderSections();

    expect(await screen.findByText('Paquetes Recovery')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tenés un plan Performance')).toBeInTheDocument();
  });
});

const activeSubscription = {
  id: 's', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn: '2026-10-01', endsOn: '2026-10-31',
  status: 'active' as const, daysLeft: 5, progressPct: 80,
};

const debitOf = (over: Partial<AutoDebitDto>): AutoDebitDto => ({
  id: 'd1', planId: 'p', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance', status: 'authorized', amount: 3900,
  frequency: 1, frequencyType: 'months', nextChargeDate: '2026-11-15', createdAt: '2026-10-14T12:00:00.000Z', cancelledAt: null,
  cancelReason: null, ...over,
});

describe('automatic debit in the profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Performance debit inside the plan card and not in the packs card', async () => {
    mockProfile({ ...subscriptions, performance: activeSubscription }, [debitOf({})]);
    renderSections();

    expect(await screen.findByText('Débito automático activo · próximo cobro 15/11')).toBeInTheDocument();
    expect(screen.getAllByText(/Débito automático/)).toHaveLength(1);
    expect(screen.getByText('Plan Mensual — Performance').closest('div.rounded')).toContainElement(
      screen.getByText('Débito automático activo · próximo cobro 15/11'),
    );
  });

  it('shows the Recovery debit inside the packs card', async () => {
    mockProfile({ ...subscriptions, performance: activeSubscription }, [
      debitOf({ id: 'd2', service: 'recovery', planSlug: 'recovery-paquete-4', nextChargeDate: '2026-11-03' }),
    ]);
    renderSections();

    expect(await screen.findByText('Débito automático activo · próximo cobro 03/11')).toBeInTheDocument();
    expect(screen.getByText('Paquetes Recovery').closest('div.rounded')).toContainElement(
      screen.getByText('Débito automático activo · próximo cobro 03/11'),
    );
  });

  it('still shows a pending debit when there is no plan or pack yet', async () => {
    mockProfile({ performance: null, upcomingPerformance: null, recoveryPacks: [] }, [debitOf({ status: 'pending', nextChargeDate: null })]);
    renderSections();

    expect(await screen.findByText('Débito automático pendiente de autorización')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tenés un plan Performance')).toBeInTheDocument();
  });

  it('confirms with the last paid day of the plan, counting the scheduled plan', async () => {
    const user = userEvent.setup();
    const upcoming = { ...activeSubscription, id: 's2', startsOn: '2026-11-01', endsOn: '2026-11-30', status: 'scheduled' as const };
    mockProfile({ ...subscriptions, performance: activeSubscription, upcomingPerformance: upcoming }, [debitOf({})]);
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Cancelar débito' }));

    expect(await screen.findByText('Lo que ya pagaste sigue vigente hasta el 30/11/2026.')).toBeInTheDocument();
  });

  it('confirms with the last pack expiry for the Recovery debit', async () => {
    const user = userEvent.setup();
    const packs = [
      { id: 'k1', planId: 'p', planName: 'Paquete 4 sesiones', startsOn: '2026-10-01', endsOn: '2026-10-31', sessionsTotal: 4, sessionsUsed: 1, sessionsLeft: 3 },
      { id: 'k2', planId: 'p', planName: 'Paquete 8 sesiones', startsOn: '2026-10-15', endsOn: '2026-11-14', sessionsTotal: 8, sessionsUsed: 0, sessionsLeft: 8 },
    ];
    mockProfile({ performance: null, upcomingPerformance: null, recoveryPacks: packs }, [debitOf({ id: 'd2', service: 'recovery' })]);
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Cancelar débito' }));

    expect(await screen.findByText('Lo que ya pagaste sigue vigente hasta el 14/11/2026.')).toBeInTheDocument();
  });
});
