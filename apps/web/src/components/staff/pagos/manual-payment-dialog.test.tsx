import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
const { ManualPaymentDialog } = await import('./manual-payment-dialog');

const trimestral = { id: 'p3', service: 'performance', kind: 'period_plan', slug: 'performance-trimestral', name: 'Plan Trimestral', price: 10500, active: true };
const clients = { items: [{ id: 'c1', name: 'Martina Suárez', email: 'martina@gmail.com' }], total: 1, page: 1, pageSize: 20 };

let plans: unknown[] = [trimestral];
let manualPayment: () => Promise<unknown> = async () => ({ purchaseId: 'x' });

const postCalls = () => apiFetch.mock.calls.filter(([path]) => path === '/staff/payments/manual');

function renderDialog(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={queryClient}>
      <ManualPaymentDialog open onOpenChange={() => undefined} />
    </QueryClientProvider>,
  );
}

async function pickClientAndPlan() {
  await userEvent.type(screen.getByLabelText('Cliente'), 'Mart');
  await userEvent.click(await screen.findByText('Martina Suárez'));
  await userEvent.selectOptions(screen.getByLabelText('Plan'), 'p3');
}

async function typeAmount(value: string) {
  const input = screen.getByLabelText('Monto (UYU)');
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

describe('ManualPaymentDialog', () => {
  beforeEach(() => {
    plans = [trimestral];
    manualPayment = async () => ({ purchaseId: 'x' });
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === '/staff/plans') return plans;
      if (path === '/staff/clients') return clients;
      if (path === '/staff/payments/manual' && init?.method === 'POST') return manualPayment();
      throw new Error(`unexpected ${path}`);
    });
  });

  it('records a cash payment with the plan price prefilled', async () => {
    renderDialog();
    await pickClientAndPlan();
    expect(screen.getByLabelText('Monto (UYU)')).toHaveValue(10500);
    await userEvent.selectOptions(screen.getByLabelText('Método'), 'cash');
    await submit();
    expect(apiFetch).toHaveBeenCalledWith('/staff/payments/manual', {
      method: 'POST', body: { userId: 'c1', planId: 'p3', method: 'cash', amount: 10500 },
    });
  });

  it('asks for a client and a plan and does not send an empty form', async () => {
    renderDialog();
    await screen.findByRole('option', { name: /Plan Trimestral/ });
    await submit();
    expect(await screen.findByText('Elegí un cliente.')).toBeInTheDocument();
    expect(screen.getByText('Elegí un plan.')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it('only offers active period plans and session packs', async () => {
    plans = [
      trimestral,
      { ...trimestral, id: 'p4', kind: 'session_pack', name: 'Pack Recovery 4' },
      { ...trimestral, id: 'p5', name: 'Plan Inactivo', active: false },
      { ...trimestral, id: 'p6', kind: 'evaluation', name: 'Evaluación Rehab' },
      { ...trimestral, id: 'p7', kind: 'single_session', name: 'Sesión Recovery' },
    ];
    renderDialog();
    await screen.findByRole('option', { name: /Pack Recovery 4/ });
    expect(screen.getByRole('option', { name: /Plan Trimestral/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Plan Inactivo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Evaluación Rehab/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Sesión Recovery/ })).not.toBeInTheDocument();
  });

  it('shows the API error inline when the payment is rejected', async () => {
    manualPayment = async () => {
      throw new ApiError(400, 'PLAN_KIND_INVALID', 'El tipo de plan no es válido para esta operación.');
    };
    renderDialog();
    await pickClientAndPlan();
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('El tipo de plan no es válido para esta operación.');
  });

  it('rejects a negative amount', async () => {
    renderDialog();
    await pickClientAndPlan();
    await typeAmount('-1');
    await submit();
    expect(await screen.findByText('El monto no puede ser negativo.')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it('rejects an amount over the cap', async () => {
    renderDialog();
    await pickClientAndPlan();
    expect(screen.getByLabelText('Monto (UYU)')).toHaveAttribute('max', '10000000');
    await typeAmount('10000001');
    await submit();
    expect(await screen.findByText('El monto no puede superar $ 10.000.000.')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it('accepts the amount cap exactly', async () => {
    renderDialog();
    await pickClientAndPlan();
    await typeAmount('10000000');
    await submit();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(postCalls()[0]?.[1]).toMatchObject({ body: { amount: 10_000_000 } });
  });

  it('rejects more than two decimals', async () => {
    renderDialog();
    await pickClientAndPlan();
    await typeAmount('10.505');
    await submit();
    expect(await screen.findByText('Usá hasta 2 decimales.')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it.each(['10.5', '10.50', '0.01', '0'])('accepts the amount %s', async (value) => {
    renderDialog();
    await pickClientAndPlan();
    await typeAmount(value);
    await submit();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(postCalls()[0]?.[1]).toMatchObject({ body: { amount: Number(value) } });
  });

  it.each(['10.505', '0.001', '99.999'])('rejects the amount %s for having more than two decimals', async (value) => {
    renderDialog();
    await pickClientAndPlan();
    await typeAmount(value);
    await submit();
    expect(await screen.findByText('Usá hasta 2 decimales.')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it('confirms the payment with a toast that ends in a period', async () => {
    renderDialog();
    await pickClientAndPlan();
    await submit();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Pago registrado.'));
  });

  it('links field errors to their inputs with aria attributes', async () => {
    renderDialog();
    await pickClientAndPlan();
    await typeAmount('-1');
    await submit();

    const amount = screen.getByLabelText('Monto (UYU)');
    const message = await screen.findByText('El monto no puede ser negativo.');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveAttribute('aria-describedby', message.id);
    expect(screen.getByLabelText('Plan')).not.toHaveAttribute('aria-invalid');
  });

  it('maps the field errors of an API validation failure onto the form', async () => {
    manualPayment = async () => {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Los datos enviados no son válidos.', [
        { field: 'amount', messages: ['amount must not be greater than 10000000'] },
        { field: 'userId', messages: ['userId must be a UUID'] },
      ]);
    };
    renderDialog();
    await pickClientAndPlan();
    await submit();

    expect(await screen.findByText('amount must not be greater than 10000000')).toBeInTheDocument();
    expect(screen.getByText('userId must be a UUID')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto (UYU)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('refreshes the payments and client queries after recording', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderDialog(queryClient);
    await pickClientAndPlan();
    await submit();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff', 'payments'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff', 'clients'] });
  });

  it('tells the staff when the client search fails', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/staff/plans') return plans;
      throw new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
    });
    renderDialog();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Mart');
    expect(await screen.findByText('No pudimos buscar clientes. Probá de nuevo.')).toBeInTheDocument();
  });
});
