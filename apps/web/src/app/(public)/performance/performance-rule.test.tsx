import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/booking/performance-schedule', () => ({
  PerformanceSchedule: () => <div data-testid="performance-schedule" />,
}));
vi.mock('@/components/public/load-plans', () => ({ loadPlans: vi.fn().mockResolvedValue([]) }));
vi.mock('@/components/public/plans-section', () => ({
  PlansSection: () => <div data-testid="performance-plans" />,
  PlansSkeleton: () => <div data-testid="plans-skeleton" />,
}));

const { default: PerformancePage } = await import('./page');

describe('PerformancePage booking rule', () => {
  it('states the rule as "Plan vigente:" and never mentions an expired plan box', () => {
    const { container } = render(<PerformancePage />);
    expect(screen.getByText('Plan vigente:')).toBeInTheDocument();
    expect(
      screen.getByText(
        /para reservar necesitás un plan activo en la fecha del turno\. Si tu plan vence, renovalo desde tu perfil para seguir reservando\./,
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('Plan vencido');
  });
});
