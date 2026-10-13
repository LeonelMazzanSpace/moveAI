import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClientPlanCard } from './plan-card';

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
});
