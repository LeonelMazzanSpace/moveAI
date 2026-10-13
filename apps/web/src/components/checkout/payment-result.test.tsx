import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PurchaseStatusDto } from '@/lib/api/types';
import { PaymentResultView } from './payment-result';

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
});
