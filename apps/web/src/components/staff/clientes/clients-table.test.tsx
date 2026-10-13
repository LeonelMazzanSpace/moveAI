import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientKpisDto, ClientRowDto, Paginated } from '@/lib/api/types';
import { ClientsTable } from './clients-table';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { ClientsView } = await import('./clients-view');

const row = (over: Partial<ClientRowDto>): ClientRowDto => ({
  id: '1', name: 'Martina Suárez', email: 'martina@gmail.com', status: 'active', pauseReason: null, planName: 'Plan Trimestral',
  endsOn: '2026-11-15', paymentStatus: 'up_to_date', lastAttendanceOn: '2026-10-10', frequencyPerWeek: 3.2, rehabCount: 0, recoveryCount: 4, ...over,
});

describe('ClientsTable', () => {
  it('renders the mockup columns and states', () => {
    render(
      <ClientsTable
        rows={[
          row({}),
          row({ id: '2', name: 'Lucía Pereira', status: 'expired', endsOn: '2026-10-02', paymentStatus: 'overdue', rehabCount: 2, recoveryCount: 0 }),
          row({ id: '3', name: 'Sofía Techera', status: 'paused', pauseReason: 'injury' }),
        ]}
      />,
    );
    const martina = screen.getByRole('row', { name: /Martina Suárez/ });
    expect(within(martina).getByText('Activo')).toBeInTheDocument();
    expect(within(martina).getByText('3.2 /sem')).toBeInTheDocument();
    expect(within(martina).getByText('Recovery ×4')).toBeInTheDocument();
    const lucia = screen.getByRole('row', { name: /Lucía Pereira/ });
    expect(within(lucia).getByText('Vencido', { selector: '[data-slot="badge"], span' })).toBeInTheDocument();
    expect(within(lucia).getByText('Rehab ×2')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Sofía Techera/ })).getByText('Pausa — Lesión')).toBeInTheDocument();
  });

  it('formats dates, payments and colours expiry by status', () => {
    render(
      <ClientsTable
        rows={[
          row({ id: '2', name: 'Camila Rodríguez', status: 'expiring', endsOn: '2026-10-14' }),
          row({ id: '3', name: 'Lucía Pereira', status: 'expired', endsOn: '2026-10-02', paymentStatus: 'overdue', lastAttendanceOn: '2026-09-28' }),
          row({ id: '4', name: 'Nuevo Cliente', status: 'no_plan', planName: null, endsOn: null, paymentStatus: 'none', lastAttendanceOn: null, frequencyPerWeek: 0, recoveryCount: 0 }),
        ]}
      />,
    );
    const camila = screen.getByRole('row', { name: /Camila Rodríguez/ });
    expect(within(camila).getByText('14/10/2026')).toHaveClass('text-warning');
    expect(within(camila).getByText('Por vencer')).toBeInTheDocument();
    expect(within(camila).getByText('Al día')).toBeInTheDocument();
    const lucia = screen.getByRole('row', { name: /Lucía Pereira/ });
    expect(within(lucia).getByText('02/10/2026')).toHaveClass('text-danger');
    expect(within(lucia).getByText('28/09')).toBeInTheDocument();
    const nuevo = screen.getByRole('row', { name: /Nuevo Cliente/ });
    expect(within(nuevo).getByText('Sin plan')).toBeInTheDocument();
    expect(within(nuevo).getAllByText('—').length).toBeGreaterThanOrEqual(5);
  });

  it('links each row to the client detail', () => {
    render(<ClientsTable rows={[row({ id: 'abc' })]} />);
    expect(screen.getByRole('link', { name: /Martina Suárez/ })).toHaveAttribute('href', '/staff/clientes/abc');
  });
});

const KPIS: ClientKpisDto = { active: 182, activeDeltaMonth: 6, expiringSoon: 12, inactive: 5, attendancesToday: 64, slotsToday: 8 };
const list = (rows: ClientRowDto[], total: number, page = 1): Paginated<ClientRowDto> => ({ items: rows, total, page, pageSize: 20 });

function mockApi(total = 41) {
  apiFetch.mockImplementation((path: string) => {
    if (path === '/staff/clients/kpis') return Promise.resolve(KPIS);
    if (path === '/staff/clients') return Promise.resolve(list([row({})], total));
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientsView />
    </QueryClientProvider>,
  );
}

describe('ClientsView', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    search = '';
  });

  it('shows the KPIs, the table and the total', async () => {
    mockApi();
    renderView();
    expect(await screen.findByRole('row', { name: /Martina Suárez/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Clientes activos' })).toHaveTextContent('182');
    expect(screen.getByText('Mostrando 1 de 41 clientes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo cliente' })).toHaveAttribute('href', '/staff/clientes/nuevo');
  });

  it('sends the search, status and page from the URL to the API', async () => {
    search = 'q=mart&status=expiring&page=2';
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    expect(apiFetch).toHaveBeenCalledWith('/staff/clients', { query: { q: 'mart', status: 'expiring', page: 2, pageSize: 20 } });
    expect(screen.getByPlaceholderText('Buscar por nombre, email o plan…')).toHaveValue('mart');
    expect(screen.getByRole('button', { name: 'Por vencer' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('debounces the search before writing it to the URL', async () => {
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    await userEvent.type(screen.getByPlaceholderText('Buscar por nombre, email o plan…'), 'luc');
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/clientes?q=luc'), { timeout: 1500 });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('writes the status filter to the URL and resets the page', async () => {
    search = 'page=3';
    mockApi();
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Por vencer' }));
    expect(replace).toHaveBeenCalledWith('/staff/clientes?status=expiring');
  });

  it('writes the page to the URL', async () => {
    search = 'q=ana&status=active';
    mockApi();
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Página siguiente' }));
    expect(replace).toHaveBeenCalledWith('/staff/clientes?q=ana&status=active&page=2');
  });
});
