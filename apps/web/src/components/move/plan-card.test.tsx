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

  it('prices a session pack per package', () => {
    const pack: PlanDto = { ...plan, kind: 'session_pack', service: 'recovery', periodMonths: null, periodDays: 30, sessionsIncluded: 4, price: 3200 };
    render(<PlanCard plan={pack} ctaHref="/x" ctaLabel="Contratar paquete" />);
    expect(screen.getByText('/paquete')).toBeInTheDocument();
    expect(screen.queryByText('/sesión')).not.toBeInTheDocument();
    expect(screen.queryByText('/mes')).not.toBeInTheDocument();
  });

  it('prices single sessions and evaluations per session', () => {
    const single: PlanDto = { ...plan, kind: 'single_session', service: 'recovery', periodMonths: null, price: 900 };
    const { rerender } = render(<PlanCard plan={single} ctaHref="/x" ctaLabel="Reservar" />);
    expect(screen.getByText('/sesión')).toBeInTheDocument();
    rerender(<PlanCard plan={{ ...single, kind: 'evaluation', service: 'rehab' }} ctaHref="/x" ctaLabel="Reservar" />);
    expect(screen.getByText('/sesión')).toBeInTheDocument();
  });

  it('lets the caller override the unit', () => {
    render(<PlanCard plan={plan} ctaHref="/x" ctaLabel="Contratar" unitLabel="/custom" />);
    expect(screen.getByText('/custom')).toBeInTheDocument();
    expect(screen.queryByText('/trim')).not.toBeInTheDocument();
  });
});
