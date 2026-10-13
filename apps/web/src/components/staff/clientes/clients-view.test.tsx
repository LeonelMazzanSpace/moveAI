import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { ClientKpisDto, ClientRowDto, Paginated, SettingsDto } from '@/lib/api/types';

let search = '';
let rerenderView: () => void = () => undefined;
const replace = vi.fn((url: string) => {
  search = url.split('?')[1] ?? '';
  rerenderView();
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { ClientsView } = await import('./clients-view');

const KPIS: ClientKpisDto = { active: 182, activeDeltaMonth: 6, expiringSoon: 12, inactive: 5, attendancesToday: 64, slotsToday: 8 };
const SETTINGS: SettingsDto = {
  cancelLimitHours: 2, bookingWindowDays: 14, pendingPaymentMinutes: 15, reconcileAfterMinutes: 10, expiringSoonDays: 10,
  noAttendanceDays: 14, prolongedInactivityDays: 21, frequencyDropRatio: 0.5, frequencyRecentWeeks: 2, frequencyBaselineWeeks: 8,
  checkinMonthlyEnabled: true, valuesProvisional: true,
};
const ROW: ClientRowDto = {
  id: '1', name: 'Martina Suárez', email: 'martina@gmail.com', status: 'active', pauseReason: null, planName: 'Plan Trimestral',
  endsOn: '2026-11-15', paymentStatus: 'up_to_date', lastAttendanceOn: '2026-10-10', frequencyPerWeek: 3.2, rehabCount: 0, recoveryCount: 4,
};
const list = (items: ClientRowDto[], total: number, page = 1): Paginated<ClientRowDto> => ({ items, total, page, pageSize: 20 });

interface Overrides {
  settings?: () => Promise<SettingsDto>;
  clients?: () => Promise<Paginated<ClientRowDto>>;
}

function mockApi({ settings, clients }: Overrides = {}) {
  apiFetch.mockImplementation((path: string) => {
    if (path === '/staff/clients/kpis') return Promise.resolve(KPIS);
    if (path === '/staff/settings') return settings ? settings() : Promise.resolve(SETTINGS);
    if (path === '/staff/clients') return clients ? clients() : Promise.resolve(list([ROW], 41));
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientsView />
    </QueryClientProvider>
  );
}

let queryClient: QueryClient;

function renderView() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<Harness />);
  rerenderView = () => view.rerender(<Harness />);
  return view;
}

const searchBox = () => screen.getByRole('searchbox', { name: 'Buscar clientes' });

describe('ClientsView KPIs', () => {
  beforeEach(() => {
    replace.mockClear();
    apiFetch.mockReset();
    search = '';
  });

  it('shows the thresholds configured in the settings instead of a fixed number', async () => {
    mockApi();
    renderView();
    expect(await screen.findByText('próximos 10 días')).toBeInTheDocument();
    expect(screen.getByText('+14 días sin asistir')).toBeInTheDocument();
    expect(screen.queryByText('próximos 7 días')).not.toBeInTheDocument();
    expect(screen.queryByText('+1 semana sin asistir')).not.toBeInTheDocument();
  });

  it('uses the singular for a one-day threshold', async () => {
    mockApi({ settings: () => Promise.resolve({ ...SETTINGS, expiringSoonDays: 1, noAttendanceDays: 1 }) });
    renderView();
    expect(await screen.findByText('próximo día')).toBeInTheDocument();
    expect(screen.getByText('+1 día sin asistir')).toBeInTheDocument();
  });

  it('keeps the KPIs without a made-up number when the settings cannot be read', async () => {
    mockApi({ settings: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) });
    renderView();
    expect(await screen.findByRole('group', { name: 'Planes por vencer' })).toHaveTextContent('12');
    expect(await screen.findByText('próximos días')).toBeInTheDocument();
    expect(screen.getByText('sin asistir')).toBeInTheDocument();
  });
});

describe('ClientsView search', () => {
  beforeEach(() => {
    replace.mockClear();
    apiFetch.mockReset();
    search = '';
  });

  it('follows the q parameter when the URL changes', async () => {
    search = 'q=mart';
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    expect(searchBox()).toHaveValue('mart');
    search = '';
    rerenderView();
    await waitFor(() => expect(searchBox()).toHaveValue(''));
    search = 'q=lucia';
    rerenderView();
    await waitFor(() => expect(searchBox()).toHaveValue('lucia'));
  });

  it('does not overwrite what is being typed when the URL catches up with the trimmed value', async () => {
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    await userEvent.type(searchBox(), 'ana ');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/clientes?q=ana'), { timeout: 1500 });
    expect(searchBox()).toHaveValue('ana ');
  });

  it('keeps a keystroke typed while the URL is still catching up with the last search', async () => {
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    // A real navigation lands later than the debounce timer: hold the URL update until after the next keystroke.
    let landUrl: () => void = () => undefined;
    replace.mockImplementationOnce((url: string) => {
      landUrl = () => {
        search = url.split('?')[1] ?? '';
        rerenderView();
      };
    });
    await userEvent.type(searchBox(), 'ana');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/clientes?q=ana'), { timeout: 1500 });
    await userEvent.type(searchBox(), 'm');
    expect(searchBox()).toHaveValue('anam');
    act(() => landUrl());
    expect(searchBox()).toHaveValue('anam');
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith('/staff/clientes?q=anam'), { timeout: 1500 });
  });

  it('keeps what is typed when the URL catches up with two searches one after the other', async () => {
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    const landings: Record<string, () => void> = {};
    const holdUrl = (url: string) => {
      landings[url] = () => {
        search = url.split('?')[1] ?? '';
        rerenderView();
      };
    };
    replace.mockImplementationOnce(holdUrl).mockImplementationOnce(holdUrl);
    await userEvent.type(searchBox(), 'ana');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/clientes?q=ana'), { timeout: 1500 });
    await userEvent.type(searchBox(), 'm');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/clientes?q=anam'), { timeout: 1500 });

    act(() => landings['/staff/clientes?q=ana']());
    expect(searchBox()).toHaveValue('anam');
    act(() => landings['/staff/clientes?q=anam']());
    expect(searchBox()).toHaveValue('anam');
  });

  it('sends a search equal to the current URL value and still follows the next change of the URL', async () => {
    search = 'q=ana';
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    // The trimmed value is the one already in the URL, so the router sends nothing back for it: it must not be kept as pending.
    await userEvent.type(searchBox(), ' ');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/clientes?q=ana'), { timeout: 1500 });
    expect(searchBox()).toHaveValue('ana ');
    search = 'q=lucia';
    rerenderView();
    await waitFor(() => expect(searchBox()).toHaveValue('lucia'));
    search = 'q=ana';
    rerenderView();
    await waitFor(() => expect(searchBox()).toHaveValue('ana'));
  });

  it('keeps a filter picked while the debounce is pending', async () => {
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    await userEvent.type(searchBox(), 'ana');
    await userEvent.click(screen.getByRole('button', { name: 'Por vencer' }));
    expect(replace).toHaveBeenLastCalledWith('/staff/clientes?status=expiring');
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith('/staff/clientes?q=ana&status=expiring'), { timeout: 1500 });
  });
});

describe('ClientsView pagination and layout', () => {
  beforeEach(() => {
    replace.mockClear();
    apiFetch.mockReset();
    search = '';
  });

  it('keeps the pagination when a page past the end is empty so staff can go back', async () => {
    search = 'page=3';
    mockApi({ clients: () => Promise.resolve(list([], 41, 3)) });
    renderView();
    expect(await screen.findByText('Sin clientes')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 0 de 41 clientes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(replace).toHaveBeenCalledWith('/staff/clientes?page=2');
  });

  it('has no pagination for an empty first page', async () => {
    mockApi({ clients: () => Promise.resolve(list([], 0)) });
    renderView();
    expect(await screen.findByText('Sin clientes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página anterior' })).not.toBeInTheDocument();
  });

  it.each([
    ['page=99999', 10_000],
    ['page=0', 1],
    ['page=1.5', 1],
    ['page=abc', 1],
  ])('bounds the page from the URL (%s)', async (query, expected) => {
    search = query;
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    expect(apiFetch).toHaveBeenCalledWith('/staff/clients', expect.objectContaining({ query: expect.objectContaining({ page: expected }) }));
  });

  it('keeps the wide table in its own horizontal scroller so the page does not overflow on mobile', async () => {
    mockApi();
    renderView();
    const table = await screen.findByRole('table');
    const scroller = table.closest('[data-slot="table-container"]');
    expect(scroller).toHaveClass('overflow-x-auto');
    expect(scroller?.parentElement).toHaveClass('min-w-0', 'max-w-full');
  });

  it('lets the search box shrink to the screen width on mobile', async () => {
    mockApi();
    renderView();
    await screen.findByRole('row', { name: /Martina Suárez/ });
    expect(searchBox().parentElement).toHaveClass('w-full', 'sm:w-72');
  });
});
