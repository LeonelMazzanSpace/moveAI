import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PurchaseStatusDto } from '@/lib/api/types';
import { findPlanSlug, PaymentResultView } from './payment-result';

const base: PurchaseStatusDto = {
  externalReference: 'r', status: 'approved', kind: 'booking', itemName: 'Evaluación y Diagnóstico', service: 'rehab',
  amount: 1800, bookingId: 'b', startsAt: '2026-10-13T14:00:00.000Z', needsAttention: false,
};

describe('PaymentResultView', () => {
  it('shows approved bookings with date and time', () => {
    render(<PaymentResultView status={base} timedOut={false} />);
    expect(screen.getByText('¡Listo! Tu pago fue aprobado.')).toBeInTheDocument();
    expect(screen.getByText(/Martes 13\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/11:00/)).toBeInTheDocument();
  });

  it('never claims approval while pending', () => {
    render(<PaymentResultView status={{ ...base, status: 'pending' }} timedOut />);
    expect(screen.queryByText('¡Listo! Tu pago fue aprobado.')).toBeNull();
    expect(screen.getByText('Tu pago está en proceso. Te avisamos por email cuando se acredite.')).toBeInTheDocument();
  });

  it('flags payments that need attention', () => {
    render(<PaymentResultView status={{ ...base, needsAttention: true }} timedOut={false} />);
    expect(screen.getByText('Recibimos tu pago pero necesitamos revisarlo. El equipo de MOVE te va a contactar.')).toBeInTheDocument();
    expect(screen.queryByText('¡Listo! Tu pago fue aprobado.')).toBeNull();
  });

  it('offers to retry when the payment did not complete', () => {
    render(<PaymentResultView status={{ ...base, status: 'rejected' }} timedOut={false} />);
    expect(screen.getByText('El pago no se completó.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/rehab#reservar');
  });

  it('lets a plan buyer retry the checkout when the payment is still pending after polling', () => {
    render(<PaymentResultView status={{ ...base, kind: 'plan', service: 'performance', status: 'pending' }} timedOut planSlug="trimestral" />);
    expect(screen.getByText('Tu pago está en proceso. Te avisamos por email cuando se acredite.')).toBeInTheDocument();
    expect(screen.getByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/trimestral');
  });

  it('falls back to the plans page when the plan slug is unknown', () => {
    render(<PaymentResultView status={{ ...base, kind: 'plan', service: 'recovery', status: 'pending' }} timedOut planSlug={null} />);
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/planes?service=recovery');
  });

  it('does not offer a retry while the plan payment is still being confirmed', () => {
    render(<PaymentResultView status={{ ...base, kind: 'plan', status: 'pending' }} timedOut={false} planSlug="trimestral" />);
    expect(screen.queryByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Intentar de nuevo' })).toBeNull();
  });

  it('does not offer a plan retry for a pending booking', () => {
    render(<PaymentResultView status={{ ...base, status: 'pending' }} timedOut planSlug="trimestral" />);
    expect(screen.queryByRole('link', { name: 'Intentar de nuevo' })).toBeNull();
  });
});

describe('findPlanSlug', () => {
  const plans = [{ name: 'Trimestral', slug: 'trimestral' }, { name: 'Mensual', slug: 'mensual' }];

  it('matches the purchased plan by name', () => {
    expect(findPlanSlug(plans, 'Mensual')).toBe('mensual');
  });

  it('returns null when the plan is not offered anymore', () => {
    expect(findPlanSlug(plans, 'Anual')).toBeNull();
    expect(findPlanSlug(undefined, 'Mensual')).toBeNull();
  });
});
