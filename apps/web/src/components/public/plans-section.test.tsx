import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanDto } from '@/lib/api/types';
import { PlansSection } from './plans-section';

const plan = (over: Partial<PlanDto>): PlanDto => ({
  id: over.slug ?? 'x', service: 'performance', kind: 'period_plan', slug: 'x', name: 'Plan', description: '',
  features: [], price: 3900, currency: 'UYU', periodMonths: 1, periodDays: null, sessionsIncluded: null,
  durationMinutes: null, featured: false, active: true, sortOrder: 1, autoDebitEnabled: false, ...over,
});

describe('PlansSection', () => {
  it('renders one card per plan with contract links', () => {
    render(
      <PlansSection
        plans={[plan({ slug: 'performance-mensual', name: 'Plan Mensual' }), plan({ slug: 'performance-trimestral', name: 'Plan Trimestral', price: 10500, periodMonths: 3, featured: true })]}
        ctaLabel="Contratar"
        hrefFor={(p) => `/checkout/plan/${p.slug}`}
      />,
    );
    expect(screen.getAllByRole('link', { name: 'Contratar' }).map((a) => a.getAttribute('href')))
      .toEqual(['/checkout/plan/performance-mensual', '/checkout/plan/performance-trimestral']);
    expect(screen.getByText('Más elegido')).toBeInTheDocument();
  });

  it('prices session packs per package, not per month', () => {
    render(
      <PlansSection
        plans={[plan({ slug: 'recovery-paquete-4', name: 'Paquete 4 sesiones', kind: 'session_pack', service: 'recovery', periodMonths: null, periodDays: 30, sessionsIncluded: 4 })]}
        ctaLabel="Contratar"
        hrefFor={(p) => `/checkout/plan/${p.slug}`}
      />,
    );
    expect(screen.getByText('/paquete')).toBeInTheDocument();
    expect(screen.queryByText('/mes')).not.toBeInTheDocument();
  });

  it('shows an empty state without plans', () => {
    render(<PlansSection plans={[]} ctaLabel="Contratar" hrefFor={() => '#'} />);
    expect(screen.getByText('Planes no disponibles por el momento')).toBeInTheDocument();
  });
});
