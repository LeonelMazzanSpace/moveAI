import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanDto } from '@/lib/api/types';
import { PlansCatalog } from './plans-catalog';

const plan = (over: Partial<PlanDto>): PlanDto => ({
  id: `id-${over.slug ?? 'x'}`, service: 'performance', kind: 'period_plan', slug: 'x', name: 'Plan', description: '',
  features: [], price: 3900, currency: 'UYU', periodMonths: 1, periodDays: null, sessionsIncluded: null,
  durationMinutes: null, featured: false, active: true, sortOrder: 1, ...over,
});

const performance = [plan({ slug: 'performance-mensual', name: 'Plan Mensual' })];
const recovery = [
  plan({ slug: 'recovery-sesion', name: 'Sesión individual', service: 'recovery', kind: 'single_session', price: 900, periodMonths: null }),
  plan({ slug: 'recovery-paquete-4', name: 'Paquete 4 sesiones', service: 'recovery', kind: 'session_pack', price: 3200, periodMonths: null, periodDays: 30 }),
];

describe('PlansCatalog', () => {
  it('shows each section with its title and plans', () => {
    render(
      <PlansCatalog
        sections={[
          { service: 'performance', plans: performance },
          { service: 'recovery', plans: recovery },
        ]}
      />,
    );

    expect(screen.getByText('Performance.')).toBeInTheDocument();
    expect(screen.getByText('Recovery.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contratar' })).toHaveAttribute('href', '/checkout/plan/performance-mensual');
    expect(screen.getByRole('link', { name: 'Reservar sesión' })).toHaveAttribute('href', '/recovery#reservar');
    expect(screen.getByRole('link', { name: 'Contratar paquete' })).toHaveAttribute('href', '/checkout/plan/recovery-paquete-4');
    expect(screen.queryByText('Planes no disponibles por el momento')).toBeNull();
  });

  it('shows a single unavailable message, without titles, when every section is empty', () => {
    render(
      <PlansCatalog
        sections={[
          { service: 'performance', plans: [] },
          { service: 'recovery', plans: [] },
        ]}
      />,
    );

    expect(screen.getAllByText('Planes no disponibles por el momento')).toHaveLength(1);
    expect(screen.queryByText('Performance.')).toBeNull();
    expect(screen.queryByText('Recovery.')).toBeNull();
  });

  it('shows a single unavailable message when the only requested section is empty', () => {
    render(<PlansCatalog sections={[{ service: 'recovery', plans: [] }]} />);

    expect(screen.getAllByText('Planes no disponibles por el momento')).toHaveLength(1);
    expect(screen.queryByText('Recovery.')).toBeNull();
  });

  it('keeps the title and shows the unavailable message in the section that came back empty', () => {
    render(
      <PlansCatalog
        sections={[
          { service: 'performance', plans: performance },
          { service: 'recovery', plans: [] },
        ]}
      />,
    );

    expect(screen.getByText('Performance.')).toBeInTheDocument();
    expect(screen.getByText('Plan Mensual')).toBeInTheDocument();
    expect(screen.getByText('Recovery.')).toBeInTheDocument();
    expect(screen.getAllByText('Planes no disponibles por el momento')).toHaveLength(1);
  });

  it('shows the unavailable message under the Performance title when only that section is empty', () => {
    render(
      <PlansCatalog
        sections={[
          { service: 'performance', plans: [] },
          { service: 'recovery', plans: recovery },
        ]}
      />,
    );

    expect(screen.getByText('Performance.')).toBeInTheDocument();
    expect(screen.getAllByText('Planes no disponibles por el momento')).toHaveLength(1);
    expect(screen.getByText('Paquete 4 sesiones')).toBeInTheDocument();
  });

  it('treats a recovery list without modalities as an empty section', () => {
    render(
      <PlansCatalog
        sections={[
          { service: 'performance', plans: performance },
          { service: 'recovery', plans: [plan({ slug: 'otro', service: 'recovery', kind: 'evaluation' })] },
        ]}
      />,
    );

    expect(screen.getByText('Recovery.')).toBeInTheDocument();
    expect(screen.getAllByText('Planes no disponibles por el momento')).toHaveLength(1);
  });
});
