import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CheckinResponseDto } from '@/lib/api/types';
import { ResponseCard } from './response-card';

const response = (over: Partial<CheckinResponseDto>): CheckinResponseDto => ({
  id: 'k1', client: { id: 'c1', name: 'Martina Suárez' }, period: '2026-10', feeling: 'good', pain: 'mild',
  painDetail: 'Molestia en hombro izquierdo al hacer press', goals: 'same', goalsDetail: null, flag: 'pain',
  respondedAt: '2026-10-12T12:42:00.000Z', frequencyPerWeek: 3.2, planName: 'Trimestral', alertId: 'al1', alertStatus: 'open', ...over,
});

const handlers = { onContact: vi.fn(), onRefer: vi.fn(), onHandle: vi.fn() };

describe('ResponseCard', () => {
  it('shows the pain quote and offers to refer to Rehab', () => {
    render(<ResponseCard response={response({})} today="2026-10-12" {...handlers} />);
    expect(screen.getByText('Molestia reportada')).toBeInTheDocument();
    expect(screen.getByText('“Molestia en hombro izquierdo al hacer press”')).toBeInTheDocument();
    expect(screen.getByText('Respondió hoy 09:42 · entrena 3.2 /sem · plan Trimestral')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contactar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Derivar a Rehab' })).toBeInTheDocument();
  });

  it('does not offer Rehab for a goals change but lets staff mark it handled', () => {
    render(
      <ResponseCard
        response={response({ flag: 'goals', pain: 'none', painDetail: null, goals: 'adjust', goalsDetail: 'Quiero preparar una maratón' })}
        today="2026-10-13" {...handlers}
      />,
    );
    expect(screen.getByText('Cambio de objetivos')).toBeInTheDocument();
    expect(screen.getByText('Respondió ayer 09:42 · entrena 3.2 /sem · plan Trimestral')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Derivar a Rehab' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar gestionado' })).toBeInTheDocument();
  });

  it('shows an all-good response with a link to the profile', () => {
    render(
      <ResponseCard
        response={response({ flag: 'ok', pain: 'none', painDetail: null, alertId: null, alertStatus: null })}
        today="2026-10-20" {...handlers}
      />,
    );
    expect(screen.getByText('Todo bien')).toBeInTheDocument();
    expect(screen.getByText(/Respondió 12\/10 09:42/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver perfil' })).toHaveAttribute('href', '/staff/clientes/c1');
    expect(screen.queryByRole('button', { name: 'Derivar a Rehab' })).not.toBeInTheDocument();
  });
});
