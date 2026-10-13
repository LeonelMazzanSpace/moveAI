import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const apiFetch = vi.fn();
const replace = vi.fn();
const searchParams = { value: new URLSearchParams('ref=ref%2F1') };

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => searchParams.value }));

const { SimulatorPanel } = await import('./simulator-panel');

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SimulatorPanel />
    </QueryClientProvider>,
  );
}

describe('SimulatorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams('ref=ref%2F1');
  });

  it('asks for the reference when it is missing', () => {
    searchParams.value = new URLSearchParams('');
    renderPanel();

    expect(screen.getByText('No encontramos la operación')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
  });

  it.each([
    ['Aprobar', 'approved'],
    ['Rechazar', 'rejected'],
  ] as const)('sends the %s outcome and continues to the result page', async (label, outcome) => {
    apiFetch.mockResolvedValue({});
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: label }));

    await vi.waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/payments/dev/simulate', {
        method: 'POST',
        body: { externalReference: 'ref/1', outcome },
      }),
    );
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/checkout/resultado?ref=ref%2F1'));
  });

  it('disables both buttons while the simulation is in flight', async () => {
    apiFetch.mockReturnValue(new Promise(() => undefined));
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));

    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
  });

  it('shows that the simulator is off when the API does not expose it', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'No encontrado.'));
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByText('Simulador desactivado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows other API errors inline and stays on the page', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'PURCHASE_NOT_FOUND', 'x'));
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La operación no existe.');
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
