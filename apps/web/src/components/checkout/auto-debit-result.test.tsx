import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AutoDebitStatusDto } from '@/lib/api/types';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { AutoDebitResult, AutoDebitResultView } = await import('./auto-debit-result');

const pending: AutoDebitStatusDto = {
  externalReference: 'deb-1', status: 'pending', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance',
  amount: 3900, nextChargeDate: null,
};
const authorized: AutoDebitStatusDto = { ...pending, status: 'authorized', nextChargeDate: '2026-11-15' };
const cancelled: AutoDebitStatusDto = { ...pending, status: 'cancelled' };

describe('AutoDebitResultView', () => {
  it('waits for the Mercado Pago confirmation while the debit is pending', () => {
    render(<AutoDebitResultView status={pending} timedOut={false} />);
    expect(screen.getByText('Confirmando tu débito')).toBeInTheDocument();
    expect(screen.getByText('Estamos esperando la confirmación de Mercado Pago. No cierres esta página.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('never claims the debit is active once the polling gave up, and offers to try again', () => {
    render(<AutoDebitResultView status={pending} timedOut />);
    expect(screen.queryByText('Débito automático activo')).toBeNull();
    expect(screen.getByText('Débito en proceso')).toBeInTheDocument();
    expect(screen.getByText(/Si no completaste la autorización, podés intentarlo de nuevo\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-mensual');
  });

  it('shows the active debit with the amount, the next charge and a link to the profile', () => {
    render(<AutoDebitResultView status={authorized} timedOut={false} />);
    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();
    expect(screen.getByText('Plan Mensual')).toBeInTheDocument();
    expect(screen.getByText('$ 3.900')).toBeInTheDocument();
    expect(screen.getByText('15/11/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a mi perfil' })).toHaveAttribute('href', '/perfil');
  });

  it('omits the next charge when the API has no date yet', () => {
    render(<AutoDebitResultView status={{ ...authorized, nextChargeDate: null }} timedOut={false} />);
    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();
    expect(screen.queryByText('Próximo cobro')).toBeNull();
  });

  it('explains a cancelled debit and links back to the checkout of that plan', () => {
    render(<AutoDebitResultView status={cancelled} timedOut={false} />);
    expect(screen.getByText('Débito no activado')).toBeInTheDocument();
    expect(screen.getByText('El débito automático no se activó o fue cancelado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-mensual');
    expect(screen.queryByRole('link', { name: 'Ir a mi perfil' })).toBeNull();
  });
});

function renderResult(reference = 'deb 1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AutoDebitResult reference={reference} />
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

const statusCalls = () => apiFetch.mock.calls.filter(([path]) => String(path).startsWith('/checkout/auto-debits/')).length;

describe('AutoDebitResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('queries the debit by its reference', async () => {
    apiFetch.mockResolvedValue(authorized);
    renderResult();
    await advance(0);

    expect(apiFetch).toHaveBeenCalledWith('/checkout/auto-debits/deb%201');
    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();
  });

  it('shows that the debit does not exist on AUTO_DEBIT_NOT_FOUND, without a retry button', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'AUTO_DEBIT_NOT_FOUND', 'x'));
    renderResult();
    await advance(0);

    expect(screen.getByText('No encontramos el débito')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('shows an error with retry when the first request fails', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x')).mockResolvedValue(authorized);
    renderResult();
    await advance(0);

    expect(screen.getByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    await act(async () => screen.getByRole('button', { name: 'Reintentar' }).click());
    await advance(0);
    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();
  });

  it('keeps polling while pending and stops once the debit is authorized', async () => {
    apiFetch.mockResolvedValueOnce(pending).mockResolvedValue(authorized);
    renderResult();
    await advance(0);
    expect(screen.getByText('Confirmando tu débito')).toBeInTheDocument();

    await advance(3000);
    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();

    const calls = statusCalls();
    await advance(30_000);
    expect(statusCalls()).toBe(calls);
  });

  it('stops polling once the debit is cancelled', async () => {
    apiFetch.mockResolvedValueOnce(pending).mockResolvedValue(cancelled);
    renderResult();
    await advance(3000);
    expect(screen.getByText('Débito no activado')).toBeInTheDocument();

    const calls = statusCalls();
    await advance(30_000);
    expect(statusCalls()).toBe(calls);
  });

  it('stops polling after 20 attempts and says the debit is in process', async () => {
    apiFetch.mockResolvedValue(pending);
    renderResult();
    await advance(0);
    expect(screen.getByText('Confirmando tu débito')).toBeInTheDocument();

    await advance(3000 * 25);

    expect(statusCalls()).toBe(20);
    expect(screen.getByText('Débito en proceso')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/checkout/plan/performance-mensual');
  });

  it('counts failed polls too: persistent errors after a pending status end in "Débito en proceso" after 20 calls', async () => {
    apiFetch.mockResolvedValueOnce(pending).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));
    renderResult();
    await advance(3000 * 40);

    expect(statusCalls()).toBe(20);
    expect(screen.getByText('Débito en proceso')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not hide the last status when a poll fails transiently', async () => {
    apiFetch
      .mockResolvedValueOnce(pending)
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'))
      .mockResolvedValue(authorized);
    renderResult();
    await advance(0);
    expect(screen.getByText('Confirmando tu débito')).toBeInTheDocument();

    await advance(3000);
    expect(screen.getByText('Confirmando tu débito')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await advance(3000);
    expect(screen.getByText('Débito automático activo')).toBeInTheDocument();
  });
});
