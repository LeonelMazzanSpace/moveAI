import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const { ManualPaymentDialog } = await import('./manual-payment-dialog');

const plans = [{ id: 'p3', service: 'performance', kind: 'period_plan', slug: 'performance-trimestral', name: 'Plan Trimestral', price: 10500, active: true }];
const clients = { items: [{ id: 'c1', name: 'Martina Suárez', email: 'martina@gmail.com' }], total: 1, page: 1, pageSize: 20 };

describe('ManualPaymentDialog', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === '/staff/plans') return plans;
      if (path === '/staff/clients') return clients;
      if (path === '/staff/payments/manual' && init?.method === 'POST') return { purchaseId: 'x' };
      throw new Error(`unexpected ${path}`);
    });
  });

  it('records a cash payment with the plan price prefilled', async () => {
    render(<QueryClientProvider client={new QueryClient()}><ManualPaymentDialog open onOpenChange={() => undefined} /></QueryClientProvider>);
    await userEvent.type(screen.getByLabelText('Cliente'), 'Mart');
    await userEvent.click(await screen.findByText('Martina Suárez'));
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'p3');
    expect(screen.getByLabelText('Monto (UYU)')).toHaveValue(10500);
    await userEvent.selectOptions(screen.getByLabelText('Método'), 'cash');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(apiFetch).toHaveBeenCalledWith('/staff/payments/manual', {
      method: 'POST', body: { userId: 'c1', planId: 'p3', method: 'cash', amount: 10500 },
    });
  });
});
