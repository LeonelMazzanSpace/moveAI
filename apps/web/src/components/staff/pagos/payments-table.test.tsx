import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffPaymentDto } from '@/lib/api/types';

const apiFetch = vi.fn();
const replace = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const { PaymentsTable, originFromParam } = await import('./payments-table');
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
  origin: 'one_time',
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

  it('stacks every payment as a card below xl so nothing needs a horizontal swipe', () => {
    render(<PaymentsTable payments={[base]} />);
    const row = screen.getByText('Martina Suárez').closest('tr');
    expect(row).toHaveClass('max-xl:grid');
    expect(row?.closest('table')).toHaveClass('max-xl:block');
    expect(screen.getByRole('columnheader', { name: 'Estado' }).closest('thead')).toHaveClass('max-xl:sr-only');
    const labels = Array.from(row?.querySelectorAll('td') ?? []).map((cell) => cell.getAttribute('data-label'));
    expect(labels).toEqual(['Fecha', null, 'Ítem', 'Servicio', 'Monto', 'Método', 'Estado']);
  });
});

describe('originFromParam', () => {
  it('maps the URL values to the API origins', () => {
    expect(originFromParam('debito')).toBe('auto_debit');
    expect(originFromParam('unico')).toBe('one_time');
  });

  it.each([undefined, '', 'auto_debit', 'one_time', 'DEBITO', 'constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'ignores %j',
    (raw) => expect(originFromParam(raw)).toBeNull(),
  );
});

describe('PaymentsTable origin', () => {
  it('marks the payments that come from an automatic debit and only those', () => {
    render(<PaymentsTable payments={[base, { ...base, purchaseId: 'pu2', client: { ...base.client, name: 'Lucía Pérez' }, origin: 'auto_debit' }]} />);

    expect(screen.getAllByText('Débito automático')).toHaveLength(1);
    expect(within(screen.getByText('Lucía Pérez').closest('tr') as HTMLElement).getByText('Débito automático')).toBeInTheDocument();
    expect(within(screen.getByText('Martina Suárez').closest('tr') as HTMLElement).queryByText('Débito automático')).toBeNull();
  });

  it('keeps the status cell readable as before for a debit payment', () => {
    render(<PaymentsTable payments={[{ ...base, origin: 'auto_debit', needsAttention: true }]} />);
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByRole('cell', { name: /^Aprobado\s*Revisar$/ })).toBeInTheDocument();
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

  it('keeps the amber tint of the active "Requieren atención" toggle on hover, in light and dark', async () => {
    renderView({ status: null, method: null, needsAttention: true, origin: null, page: 1 });
    await screen.findByText('Martina Suárez');
    const toggle = screen.getByRole('button', { name: 'Requieren atención' });
    expect(toggle).toHaveClass('bg-warning-muted', 'text-warning', 'hover:bg-warning-muted', 'hover:text-warning', 'dark:hover:bg-warning-muted');
    for (const ghost of ['hover:bg-muted', 'hover:text-foreground', 'dark:hover:bg-muted/50']) expect(toggle).not.toHaveClass(ghost);
  });

  it('sends the filters to the API', async () => {
    renderView({ status: 'pending', method: 'cash', needsAttention: true, origin: null, page: 2 });
    await screen.findByText('Martina Suárez');
    expect(apiFetch).toHaveBeenCalledWith('/staff/payments', {
      query: { status: 'pending', method: 'cash', needsAttention: true, page: 2, pageSize: 20 },
    });
  });

  it('reflects filter changes in the URL and resets the page', async () => {
    renderView({ status: null, method: null, needsAttention: false, origin: null, page: 3 });
    await screen.findByText('Martina Suárez');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'approved');
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?estado=approved', { scroll: false });
    await userEvent.click(screen.getByRole('button', { name: 'Requieren atención' }));
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?atencion=1', { scroll: false });
  });

  it('sends the origin filter to the API as one_time or auto_debit', async () => {
    renderView({ status: null, method: null, needsAttention: false, origin: 'auto_debit', page: 1 });
    await screen.findByText('Martina Suárez');
    expect(apiFetch).toHaveBeenCalledWith('/staff/payments', {
      query: { origin: 'auto_debit', needsAttention: undefined, status: undefined, method: undefined, page: 1, pageSize: 20 },
    });
    expect(screen.getByLabelText('Origen')).toHaveValue('debito');
  });

  it('does not send an origin when none is chosen', async () => {
    renderView({ status: null, method: null, needsAttention: false, origin: null, page: 1 });
    await screen.findByText('Martina Suárez');
    expect(apiFetch.mock.calls[0][1].query.origin).toBeUndefined();
    expect(screen.getByLabelText('Origen')).toHaveValue('');
  });

  it('reflects the origin in the URL as debito or unico and resets the page', async () => {
    renderView({ status: null, method: null, needsAttention: false, origin: null, page: 3 });
    await screen.findByText('Martina Suárez');
    const origin = screen.getByLabelText('Origen');
    expect(within(origin).getAllByRole('option').map((option) => option.textContent)).toEqual(['Todos', 'Pago único', 'Débito automático']);
    await userEvent.selectOptions(origin, 'debito');
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?origen=debito', { scroll: false });
    await userEvent.selectOptions(origin, 'unico');
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?origen=unico', { scroll: false });
  });

  it('keeps the origin when another filter or the page changes, and clears it on "Todos"', async () => {
    renderView({ status: null, method: null, needsAttention: false, origin: 'auto_debit', page: 1 });
    await screen.findByText('Martina Suárez');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'approved');
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?estado=approved&origen=debito', { scroll: false });
    await userEvent.selectOptions(screen.getByLabelText('Origen'), '');
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos', { scroll: false });
  });

  it('offers a way back from an empty page past the end', async () => {
    apiFetch.mockResolvedValue({ items: [], total: 45, page: 99, pageSize: 20 });
    renderView({ status: null, method: null, needsAttention: false, origin: null, page: 99 });
    expect(await screen.findByText('Sin pagos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(replace).toHaveBeenLastCalledWith('/staff/pagos?pagina=3', { scroll: false });
  });
});

describe('PaymentsTable semantics below xl', () => {
  it('spells the table roles so they survive display block/grid', () => {
    render(<PaymentsTable payments={[base, { ...base, purchaseId: 'pu2' }]} />);
    const table = screen.getByRole('table');
    expect(screen.getAllByRole('rowgroup')).toHaveLength(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Fecha',
      'Cliente',
      'Ítem',
      'Servicio',
      'Monto',
      'Método',
      'Estado',
    ]);
    for (const element of table.querySelectorAll('thead, tbody, tr, th, td')) expect(element).toHaveAttribute('role');
  });

  it('labels the client cell and keeps the status readable as a cell', () => {
    render(<PaymentsTable payments={[{ ...base, needsAttention: true }]} />);
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByRole('cell', { name: /^Cliente: Martina Suárez martina@gmail\.com$/ })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: /^Aprobado\s*Revisar$/ })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: '$ 10.500' })).toBeInTheDocument();
  });

  it('shows the cells in the same order below xl as in the DOM', () => {
    render(<PaymentsTable payments={[base]} />);
    const cells = Array.from(screen.getAllByRole('row')[1].querySelectorAll('td'));
    for (const cell of cells) expect(cell.className).not.toMatch(/max-xl:order-/);
  });
});
