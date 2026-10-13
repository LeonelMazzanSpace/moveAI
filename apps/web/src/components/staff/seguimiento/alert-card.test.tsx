import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AlertDto } from '@/lib/api/types';
import { AlertCard } from './alert-card';

const alert = (over: Partial<AlertDto>): AlertDto => ({
  id: 'a1', type: 'expiring', status: 'open', client: { id: 'c1', name: 'Federico Álvez', initials: 'FA' },
  planName: 'Plan Mensual', endsOn: '2026-10-18', lastAttendanceOn: '2026-10-08', frequencyPerWeek: 2.5,
  usualFrequencyPerWeek: 2.5, contactsCount: 0, pause: null, checkin: null, createdAt: '2026-10-12T10:00:00.000Z', ...over,
});

describe('AlertCard', () => {
  it('renders an expiring alert like the mockup', () => {
    render(<AlertCard alert={alert({})} today="2026-10-12" onContact={vi.fn()} onHandle={vi.fn()} onReason={vi.fn()} />);
    expect(screen.getByText('FA')).toBeInTheDocument();
    expect(screen.getByText('Plan vence en 6 días')).toBeInTheDocument();
    expect(screen.getByText(/Plan Mensual · vence 18\/10\/2026 · última asistencia 08\/10 · frecuencia 2.5 \/sem/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contactar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar gestionado' })).toBeInTheDocument();
  });

  it('renders a recontact alert for a paused client', () => {
    render(
      <AlertCard
        alert={alert({ type: 'recontact', client: { id: 'c2', name: 'Sofía Techera', initials: 'ST' }, pause: { reason: 'injury', since: '2026-09-24T12:00:00.000Z', recontactOn: '2026-11-01' } })}
        today="2026-11-01" onContact={vi.fn()} onHandle={vi.fn()} onReason={vi.fn()}
      />,
    );
    expect(screen.getByText('Re-contactar el 01/11')).toBeInTheDocument();
    expect(screen.getByText(/Pausa por lesión registrada el 24\/09/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver historial' })).toHaveAttribute('href', '/staff/clientes/c2');
  });

  it('shows the expired badge, previous contacts and the reason action', () => {
    render(
      <AlertCard
        alert={alert({ type: 'expired', endsOn: '2026-10-02', contactsCount: 2 })}
        today="2026-10-12" onContact={vi.fn()} onHandle={vi.fn()} onReason={vi.fn()}
      />,
    );
    expect(screen.getByText('Vencido sin renovación')).toBeInTheDocument();
    expect(screen.getByText(/venció 02\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/2 contactos previos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar motivo' })).toBeInTheDocument();
  });

  it('quotes the check-in detail on a pain alert', () => {
    render(
      <AlertCard
        alert={alert({ type: 'checkin_pain', checkin: { id: 'k1', painDetail: 'Molestia en hombro izquierdo', goalsDetail: null } })}
        today="2026-10-12" onContact={vi.fn()} onHandle={vi.fn()} onReason={vi.fn()}
      />,
    );
    expect(screen.getByText('Molestia reportada')).toBeInTheDocument();
    expect(screen.getByText('“Molestia en hombro izquierdo”')).toBeInTheDocument();
  });
});
