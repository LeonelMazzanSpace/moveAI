import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MySubscriptionsDto } from '@/lib/api/types';
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
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x')).mockResolvedValue(subscriptions);
    renderSections();

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Paquete 4 sesiones')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tenés un plan Performance')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders both sections when the request succeeds', async () => {
    apiFetch.mockResolvedValue(subscriptions);
    renderSections();

    expect(await screen.findByText('Paquetes Recovery')).toBeInTheDocument();
    expect(screen.getByText('Todavía no tenés un plan Performance')).toBeInTheDocument();
  });
});
