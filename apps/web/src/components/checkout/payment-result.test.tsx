import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { PurchaseStatusDto } from '@/lib/api/types';

const apiFetch = vi.fn();
const searchParams = { value: new URLSearchParams('ref=ref-1') };

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams.value }));

const { PaymentResult, PaymentResultView } = await import('./payment-result');

const base: PurchaseStatusDto = {
  externalReference: 'ref-1', status: 'approved', kind: 'booking', itemName: 'Evaluación y Diagnóstico', service: 'rehab',
  amount: 1800, bookingId: 'b', startsAt: '2026-10-13T14:00:00.000Z', needsAttention: false, planSlug: null,
};
const pendingPlan: PurchaseStatusDto = {
  ...base, kind: 'plan', service: 'performance', status: 'pending', itemName: 'Plan Trimestral', bookingId: null, startsAt: null,
  planSlug: 'performance-trimestral',
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

  it('sends a rejected plan purchase back to its own checkout', () => {
    render(<PaymentResultView status={{ ...pendingPlan, status: 'rejected' }} timedOut={false} />);
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-trimestral');
  });

  it('lets a plan buyer retry the checkout when the payment is still pending after polling', () => {
    render(<PaymentResultView status={pendingPlan} timedOut />);
    expect(screen.getByText('Tu pago está en proceso. Te avisamos por email cuando se acredite.')).toBeInTheDocument();
    expect(screen.getByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-trimestral');
  });

  it('falls back to the plans page when the plan slug is unknown', () => {
    render(<PaymentResultView status={{ ...pendingPlan, service: 'recovery', planSlug: null }} timedOut />);
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/planes?service=recovery');
  });

  it('does not offer a retry while the plan payment is still being confirmed', () => {
    render(<PaymentResultView status={pendingPlan} timedOut={false} />);
    expect(screen.queryByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Intentar de nuevo' })).toBeNull();
  });

  it('does not offer a plan retry for a pending booking', () => {
    render(<PaymentResultView status={{ ...base, status: 'pending' }} timedOut />);
    expect(screen.queryByRole('link', { name: 'Intentar de nuevo' })).toBeNull();
  });
});

function renderResult() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentResult />
    </QueryClientProvider>,
  );
}

/** Avanza el reloj falso; el milisegundo final deja correr el `setTimeout(0)` con el que TanStack Query notifica a React. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.advanceTimersByTimeAsync(1);
  });
}

const statusCalls = () => apiFetch.mock.calls.filter(([path]) => String(path).startsWith('/checkout/purchases/')).length;

describe('PaymentResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    searchParams.value = new URLSearchParams('ref=ref-1');
  });
  afterEach(() => vi.useRealTimers());

  it('asks for the reference when the link has none', () => {
    searchParams.value = new URLSearchParams('');
    renderResult();
    expect(screen.getByText('No encontramos la operación')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows that the operation does not exist on PURCHASE_NOT_FOUND', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'PURCHASE_NOT_FOUND', 'La operación no existe.'));
    renderResult();
    await advance(0);

    expect(screen.getByText('No encontramos la operación')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(apiFetch).toHaveBeenCalledWith('/checkout/purchases/ref-1');
  });

  it('shows an error with retry when the first request fails', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x')).mockResolvedValue({ ...base });
    renderResult();
    await advance(0);

    expect(screen.getByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    await act(async () => screen.getByRole('button', { name: 'Reintentar' }).click());
    await advance(0);
    expect(screen.getByText('¡Listo! Tu pago fue aprobado.')).toBeInTheDocument();
  });

  it('keeps polling while pending and stops when the payment is approved', async () => {
    apiFetch.mockResolvedValueOnce({ ...base, status: 'pending' }).mockResolvedValue({ ...base });
    renderResult();
    await advance(0);
    expect(screen.getByText('Confirmando tu pago')).toBeInTheDocument();

    await advance(3000);
    expect(screen.getByText('¡Listo! Tu pago fue aprobado.')).toBeInTheDocument();

    const calls = statusCalls();
    await advance(30_000);
    expect(statusCalls()).toBe(calls);
  });

  it('stops polling after 20 attempts and says the payment is in process', async () => {
    apiFetch.mockResolvedValue({ ...base, status: 'pending' });
    renderResult();
    await advance(0);
    expect(screen.getByText('Confirmando tu pago')).toBeInTheDocument();

    await advance(3000 * 25);

    expect(statusCalls()).toBe(20);
    expect(screen.getByText('Pago en proceso')).toBeInTheDocument();
    expect(screen.getByText('Tu pago está en proceso. Te avisamos por email cuando se acredite.')).toBeInTheDocument();
  });

  it('counts failed polls too: persistent errors after a pending status end in "Pago en proceso" after 20 calls', async () => {
    apiFetch.mockResolvedValueOnce({ ...base, status: 'pending' }).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));
    renderResult();
    await advance(3000 * 40);

    expect(statusCalls()).toBe(20);
    expect(screen.getByText('Pago en proceso')).toBeInTheDocument();
    expect(screen.getByText('Tu pago está en proceso. Te avisamos por email cuando se acredite.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers the plan retry link when persistent errors follow a pending plan purchase', async () => {
    apiFetch.mockResolvedValueOnce(pendingPlan).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderResult();
    await advance(3000 * 40);

    expect(statusCalls()).toBe(20);
    expect(screen.getByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-trimestral');
  });

  it('still waits through a few transient errors before the cap', async () => {
    apiFetch
      .mockResolvedValueOnce({ ...base, status: 'pending' })
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'))
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'))
      .mockResolvedValue({ ...base, status: 'pending' });
    renderResult();
    await advance(3000 * 5);

    expect(statusCalls()).toBe(6);
    expect(screen.getByText('Confirmando tu pago')).toBeInTheDocument();
  });

  it('uses the plan slug from the API for the retry link of a pending plan purchase', async () => {
    apiFetch.mockResolvedValue(pendingPlan);
    renderResult();
    await advance(3000 * 25);

    expect(screen.getByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-trimestral');
    expect(apiFetch).not.toHaveBeenCalledWith('/catalog/plans', expect.anything());
  });

  it('does not hide the last result when a poll fails transiently', async () => {
    apiFetch
      .mockResolvedValueOnce({ ...base, status: 'pending' })
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'))
      .mockResolvedValue({ ...base });
    renderResult();
    await advance(0);
    expect(screen.getByText('Confirmando tu pago')).toBeInTheDocument();

    await advance(3000);
    expect(screen.getByText('Confirmando tu pago')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await advance(3000);
    expect(screen.getByText('¡Listo! Tu pago fue aprobado.')).toBeInTheDocument();
  });
});

describe('PaymentResult for an automatic debit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the debit result when the link carries ?debito=', async () => {
    searchParams.value = new URLSearchParams('debito=deb-1');
    apiFetch.mockResolvedValue({
      externalReference: 'deb-1', status: 'authorized', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance',
      amount: 3900, nextChargeDate: '2026-11-15',
    });
    renderResult();
    await advance(0);

    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/checkout/auto-debits/deb-1');
    expect(statusCalls()).toBe(0);
  });

  it('keeps showing the purchase result for ?ref=', async () => {
    searchParams.value = new URLSearchParams('ref=ref-1');
    apiFetch.mockResolvedValue({ ...base });
    renderResult();
    await advance(0);

    expect(screen.getByText('¡Listo! Tu pago fue aprobado.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/checkout/auto-debits/'));
  });
});

describe('PaymentResult live region', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('announces politely, from the first render, the change of a purchase from pending to approved', async () => {
    searchParams.value = new URLSearchParams('ref=ref-1');
    apiFetch.mockResolvedValueOnce({ ...base, status: 'pending' }).mockResolvedValue({ ...base });
    renderResult();

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    await advance(0);
    expect(region).toHaveTextContent('Confirmando tu pago');

    await advance(3000);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('¡Listo! Tu pago fue aprobado.');
    expect(region).not.toHaveTextContent('Confirmando tu pago');
  });

  it('announces the change of an automatic debit from pending to active in the same region', async () => {
    searchParams.value = new URLSearchParams('debito=deb-1');
    const pending = {
      externalReference: 'deb-1', status: 'pending', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance',
      amount: 3900, nextChargeDate: null,
    };
    apiFetch.mockResolvedValueOnce(pending).mockResolvedValue({ ...pending, status: 'authorized', nextChargeDate: '2026-11-15' });
    renderResult();

    const region = screen.getByRole('status');
    await advance(0);
    expect(region).toHaveTextContent('Confirmando tu débito');

    await advance(3000);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Débito automático activo');
  });

  it('announces a debit that ended cancelled', async () => {
    searchParams.value = new URLSearchParams('debito=deb-1');
    const pending = {
      externalReference: 'deb-1', status: 'pending', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance',
      amount: 3900, nextChargeDate: null,
    };
    apiFetch.mockResolvedValueOnce(pending).mockResolvedValue({ ...pending, status: 'cancelled' });
    renderResult();

    const region = screen.getByRole('status');
    await advance(3000);
    expect(region).toHaveTextContent('Débito no activado');
  });

  it('keeps the region when the link has no reference', () => {
    searchParams.value = new URLSearchParams('');
    renderResult();
    expect(screen.getByRole('status')).toHaveTextContent('No encontramos la operación');
  });
});
