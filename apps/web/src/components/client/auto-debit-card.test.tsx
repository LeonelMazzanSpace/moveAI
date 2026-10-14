import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AutoDebitDto } from '@/lib/api/types';
import { AutoDebitCard } from './auto-debit-card';

const { apiFetch, toast } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('sonner', () => ({ toast }));

const debit = (over: Partial<AutoDebitDto> = {}): AutoDebitDto => ({
  id: 'd1', planId: 'p1', planName: 'Plan Mensual', planSlug: 'performance-mensual', service: 'performance', status: 'authorized',
  amount: 3900, frequency: 1, frequencyType: 'months', nextChargeDate: '2026-11-15', createdAt: '2026-10-14T12:00:00.000Z',
  cancelledAt: null, cancelReason: null, ...over,
});

function renderCard(props: Partial<Parameters<typeof AutoDebitCard>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AutoDebitCard service="performance" endsOn="2026-10-31" {...props} />
    </QueryClientProvider>,
  );
  const settled = () => waitFor(() => expect(queryClient.getQueryState(['me', 'auto-debits'])?.fetchStatus).toBe('idle'));
  return { invalidate, settled, queryClient, ...view };
}

function mockDebits(debits: AutoDebitDto[], cancel: () => unknown = () => debit({ status: 'cancelled' })) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/me/auto-debits') return debits;
    if (path === '/me/auto-debits/d1/cancel' && init?.method === 'POST') return cancel();
    throw new Error(`unexpected request ${path}`);
  });
}

describe('AutoDebitCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the active debit with the day and month of the next charge', async () => {
    mockDebits([debit()]);
    renderCard();

    expect(await screen.findByText('Débito automático activo · próximo cobro 15/11')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/me/auto-debits');
  });

  it('says it is activo without a date when the next charge is unknown', async () => {
    mockDebits([debit({ nextChargeDate: null })]);
    renderCard();

    expect(await screen.findByText('Débito automático activo')).toBeInTheDocument();
  });

  it('shows a debit that still needs Mercado Pago authorization', async () => {
    mockDebits([debit({ status: 'pending', nextChargeDate: null })]);
    renderCard();

    expect(await screen.findByText('Débito automático pendiente de autorización')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar débito' })).toBeInTheDocument();
  });

  it('only shows the debit of its own service', async () => {
    mockDebits([debit({ id: 'd2', service: 'recovery', planSlug: 'recovery-paquete-4' })]);
    const view = renderCard({ service: 'performance' });
    await view.settled();

    expect(screen.queryByText(/Débito automático/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar débito' })).toBeNull();
  });

  it.each([
    ['cancelled', [debit({ status: 'cancelled', cancelledAt: '2026-10-15T12:00:00.000Z', cancelReason: 'client' })]],
    ['empty', []],
  ])('renders nothing for a %s list', async (_label, debits) => {
    mockDebits(debits);
    const view = renderCard();
    await view.settled();

    expect(view.container).toBeEmptyDOMElement();
  });

  it('renders nothing while the debits are loading', () => {
    apiFetch.mockImplementation(() => new Promise(() => undefined));
    const view = renderCard();

    expect(view.container).toBeEmptyDOMElement();
  });

  it('tells the client the debit could not be loaded, instead of hiding it, and offers to retry', async () => {
    apiFetch.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    const view = renderCard();
    await view.settled();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu débito automático.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Cancelar débito' })).toBeNull();
  });

  it('shows the debit and its cancel button once the retry works', async () => {
    mockDebits([debit()]);
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Débito automático activo · próximo cobro 15/11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar débito' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps showing a known debit when a later refresh fails', async () => {
    mockDebits([debit()]);
    const view = renderCard();
    await screen.findByText('Débito automático activo · próximo cobro 15/11');
    apiFetch.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    await view.queryClient.invalidateQueries({ queryKey: ['me', 'auto-debits'] });
    await view.settled();

    expect(screen.getByText('Débito automático activo · próximo cobro 15/11')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks for confirmation before cancelling and says what stays valid', async () => {
    mockDebits([debit()]);
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));

    expect(await screen.findByText('Lo que ya pagaste sigue vigente hasta el 31/10/2026.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith('/me/auto-debits/d1/cancel', expect.anything());
  });

  it('does not cancel when the client goes back', async () => {
    mockDebits([debit()]);
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByText(/Lo que ya pagaste sigue vigente/)).toBeNull());
    expect(apiFetch).not.toHaveBeenCalledWith('/me/auto-debits/d1/cancel', expect.anything());
  });

  it('keeps the message short when no end date is known', async () => {
    mockDebits([debit()]);
    renderCard({ endsOn: null });

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));

    expect(await screen.findByText('Lo que ya pagaste sigue vigente.')).toBeInTheDocument();
  });

  it('cancels after confirming, refreshes debits and subscriptions and closes the dialog', async () => {
    mockDebits([debit()]);
    const { invalidate } = renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/me/auto-debits/d1/cancel', { method: 'POST' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'auto-debits'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'subscriptions'] });
    expect(toast.success).toHaveBeenCalledWith('Débito automático cancelado');
    await waitFor(() => expect(screen.queryByText(/Lo que ya pagaste sigue vigente/)).toBeNull());
  });

  it('disables the confirm button while the cancellation is in flight', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/me/auto-debits') return [debit()];
      return new Promise(() => undefined);
    });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    expect(screen.getByRole('button', { name: 'Sí, cancelar débito' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
  });

  it('shows a recoverable error when Mercado Pago fails and keeps the debit and the dialog', async () => {
    mockDebits([debit()], () => {
      throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'x');
    });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cancelar el débito en Mercado Pago. Sigue activo: probá de nuevo en unos minutos.',
    );
    expect(screen.getByRole('button', { name: 'Sí, cancelar débito' })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows other API errors inline', async () => {
    mockDebits([debit()], () => {
      throw new ApiError(404, 'AUTO_DEBIT_NOT_FOUND', 'x');
    });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos ese débito automático.');
  });
});
