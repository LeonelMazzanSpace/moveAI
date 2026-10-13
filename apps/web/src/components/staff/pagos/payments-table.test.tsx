import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffPaymentDto } from '@/lib/api/types';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const { PaymentsTable } = await import('./payments-table');
const { PaymentsView } = await import('./payments-view');

const base: StaffPaymentDto = {
  purchaseId: 'pu1',
  client: { id: 'c1', name: 'Martina Suárez', email: 'martina@gmail.com' },
  itemName: 'Plan Trimestral',
  service: 'performance',
  amount: 10500,
  method: 'mercadopago',
  status: 'approved',
  needsAttention: false,
  createdAt: '2026-10-12T21:00:00.000Z',
  approvedAt: '2026-10-12T21:01:00.000Z',
  note: null,
};

describe('PaymentsTable', () => {
  it('renders an approved Mercado Pago payment', () => {
    render(<PaymentsTable payments={[base]} />);
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
    expect(screen.getByText('$ 10.500')).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago')).toBeInTheDocument();
    expect(screen.getByText('martina@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('Revisar')).not.toBeInTheDocument();
  });

  it('flags payments that need attention', () => {
    render(<PaymentsTable payments={[{ ...base, purchaseId: 'pu2', needsAttention: true }]} />);
    expect(screen.getByText('Revisar')).toBeInTheDocument();
  });

  it('highlights the row that needs attention and only that row', () => {
    render(<PaymentsTable payments={[base, { ...base, purchaseId: 'pu2', client: { ...base.client, name: 'Lucía Pérez' }, needsAttention: true }]} />);
    expect(screen.getByText('Lucía Pérez').closest('tr')).toHaveClass('bg-warning-muted/40');
    expect(screen.getByText('Martina Suárez').closest('tr')).not.toHaveClass('bg-warning-muted/40');
  });
});

describe('PaymentsView filters', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    replace.mockReset();
    apiFetch.mockResolvedValue({ items: [base], total: 1, page: 1, pageSize: 20 });
  });

  function renderView(filters: Parameters<typeof PaymentsView>[0]['filters']) {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PaymentsView filters={filters} />
      </QueryClientProvider>,
    );
  }

  it('sends the filters to the API', async () => {
    renderView({ status: 'pending', method: 'cash', needsAttention: true, page: 2 });
    await screen.findByText('Martina Suárez');
    expect(apiFetch).toHaveBeenCalledWith('/staff/payments', {
      query: { status: 'pending', method: 'cash', needsAttention: true, page: 2, pageSize: 20 },
    });
  });

  it('reflects filter changes in the URL and resets the page', async () => {
    renderView({ status: null, method: null, needsAttention: false, page: 3 });
    await screen.findByText('Martina Suárez');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'approved');
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?estado=approved', { scroll: false });
    await userEvent.click(screen.getByRole('button', { name: 'Requieren atención' }));
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?atencion=1', { scroll: false });
  });

  it('offers a way back from an empty page past the end', async () => {
    apiFetch.mockResolvedValue({ items: [], total: 45, page: 99, pageSize: 20 });
    renderView({ status: null, method: null, needsAttention: false, page: 99 });
    expect(await screen.findByText('Sin pagos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?pagina=3', { scroll: false });
  });
});
