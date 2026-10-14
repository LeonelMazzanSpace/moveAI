import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanDto } from '@/lib/api/types';
import { RecoveryModalities } from './recovery-modalities';

const plan = (over: Partial<PlanDto>): PlanDto => ({
  id: over.slug ?? 'x', service: 'recovery', kind: 'session_pack', slug: 'x', name: 'Plan', description: '',
  features: [], price: 3200, currency: 'UYU', periodMonths: null, periodDays: 30, sessionsIncluded: 4,
  durationMinutes: 45, featured: false, active: true, sortOrder: 1, autoDebitEnabled: false, ...over,
});

const plans: PlanDto[] = [
  plan({ slug: 'recovery-sesion', name: 'Sesión individual', kind: 'single_session', price: 900, periodDays: null, sessionsIncluded: 1, sortOrder: 1 }),
  plan({ slug: 'recovery-paquete-4', name: 'Paquete 4 sesiones', price: 3200, featured: true, sortOrder: 2 }),
  plan({ slug: 'recovery-paquete-8', name: 'Paquete 8 sesiones', price: 5900, sessionsIncluded: 8, features: ['8 sesiones por mes', 'Prioridad de horarios'], sortOrder: 3 }),
];

describe('RecoveryModalities', () => {
  it('shows price units per modality and the featured tag', () => {
    render(<RecoveryModalities plans={plans} />);
    expect(screen.getByText('$ 900')).toBeInTheDocument();
    expect(screen.getByText('/sesión')).toBeInTheDocument();
    expect(screen.getByText('$ 3.200')).toBeInTheDocument();
    expect(screen.getAllByText('/paquete')).toHaveLength(2);
    expect(screen.queryByText('/mes')).toBeNull();
    expect(screen.getAllByText('Recomendado')).toHaveLength(1);
  });

  it('links each modality to its CTA', () => {
    render(<RecoveryModalities plans={plans} />);
    expect(screen.getByRole('link', { name: 'Reservar sesión' })).toHaveAttribute('href', '/recovery#reservar');
    expect(screen.getAllByRole('link', { name: 'Contratar paquete' }).map((a) => a.getAttribute('href')))
      .toEqual(['/checkout/plan/recovery-paquete-4', '/checkout/plan/recovery-paquete-8']);
  });

  it('never shows "Prioridad de horarios"', () => {
    render(<RecoveryModalities plans={plans} />);
    expect(screen.queryByText(/Prioridad de horarios/)).toBeNull();
  });

  it('shows an empty state without plans', () => {
    render(<RecoveryModalities plans={[]} />);
    expect(screen.getByText('Planes no disponibles por el momento')).toBeInTheDocument();
  });
});
