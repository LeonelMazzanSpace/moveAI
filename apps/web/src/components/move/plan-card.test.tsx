import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanDto } from '@/lib/api/types';
import { PlanCard } from './plan-card';

const plan: PlanDto = {
  id: 'p1', service: 'performance', kind: 'period_plan', slug: 'performance-trimestral', name: 'Plan Trimestral',
  description: '', features: ['Asistencias ilimitadas con reserva', 'Ahorrás un 10% vs. mensual'], price: 10500,
  currency: 'UYU', periodMonths: 3, periodDays: null, sessionsIncluded: null, durationMinutes: null,
  featured: true, active: true, sortOrder: 2,
};

describe('PlanCard', () => {
  it('renders price, period, features, featured tag and CTA', () => {
    render(<PlanCard plan={plan} ctaHref="/checkout/plan/performance-trimestral" ctaLabel="Contratar" />);
    expect(screen.getByText('$ 10.500')).toBeInTheDocument();
    expect(screen.getByText('/trim')).toBeInTheDocument();
    expect(screen.getByText('Más elegido')).toBeInTheDocument();
    expect(screen.getByText('Ahorrás un 10% vs. mensual')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contratar' })).toHaveAttribute('href', '/checkout/plan/performance-trimestral');
  });

  it('never shows the removed "Prioridad de horarios" text', () => {
    const withPriority = { ...plan, features: [...plan.features, 'Prioridad de horarios'] };
    render(<PlanCard plan={withPriority} ctaHref="/x" ctaLabel="Contratar" />);
    expect(screen.queryByText(/prioridad de horarios/i)).not.toBeInTheDocument();
  });

  it('shows no tag when the plan is not featured', () => {
    render(<PlanCard plan={{ ...plan, featured: false }} ctaHref="/x" ctaLabel="Contratar" />);
    expect(screen.queryByText('Más elegido')).not.toBeInTheDocument();
  });
});
