import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AlertCountsDto, AlertDto } from '@/lib/api/types';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }));

const { FollowupView } = await import('./followup-view');

const COUNTS: AlertCountsDto = {
  expiring: 12, expired: 4, no_attendance: 3, prolonged_inactivity: 2, frequency_drop: 1, recontact: 1,
  checkin_pain: 0, checkin_goals: 0, total: 23,
};

const alert = (over: Partial<AlertDto>): AlertDto => ({
  id: 'a1', type: 'expiring', status: 'open', client: { id: 'c1', name: 'Federico Álvez', initials: 'FA' },
  planName: 'Plan Mensual', endsOn: '2026-10-18', lastAttendanceOn: '2026-10-08', frequencyPerWeek: 2.5,
  usualFrequencyPerWeek: 2.5, contactsCount: 0, pause: null, checkin: null, createdAt: '2026-10-12T10:00:00.000Z', ...over,
});

interface Init {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}

function mockApi(overrides: Record<string, (init?: Init) => Promise<unknown>> = {}) {
  apiFetch.mockImplementation((path: string, init?: Init) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    if (overrides[key]) return overrides[key](init);
    if (key === 'GET /staff/alerts/counts') return Promise.resolve(COUNTS);
    if (key === 'GET /staff/alerts') return Promise.resolve([alert({})]);
    if (key.startsWith('POST ')) return Promise.resolve({});
    return Promise.reject(new Error(`unexpected ${key}`));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FollowupView />
    </QueryClientProvider>,
  );
}

describe('FollowupView', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    toastError.mockReset();
    search = '';
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the counters from the API and filters through the URL', async () => {
    mockApi();
    renderView();
    expect(await screen.findByRole('button', { name: 'Todas · 23' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vencidos sin renovar · 4' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Por vencer · 12' }));
    expect(replace).toHaveBeenCalledWith('/staff/seguimiento?tipo=expiring');
  });

  it('reads the filter from the URL and asks only for that type', async () => {
    search = 'tipo=expiring';
    mockApi();
    renderView();
    expect(await screen.findByText('Federico Álvez')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/staff/alerts', { query: { type: 'expiring', status: 'open' } });
    expect(screen.getByRole('button', { name: 'Por vencer · 12' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('records a contact with channel, outcome and note', async () => {
    mockApi();
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Contactar' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'WhatsApp' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Habló con la persona' }));
    await userEvent.type(within(dialog).getByLabelText('Nota'), 'Va a renovar el viernes');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/a1/contacts', {
        method: 'POST',
        body: { channel: 'whatsapp', outcome: 'reached', note: 'Va a renovar el viernes' },
      }),
    );
  });

  it('registers an inactivity reason for the client', async () => {
    mockApi({ 'GET /staff/alerts': () => Promise.resolve([alert({ type: 'expired' })]) });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar motivo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/inactivity-reasons', { method: 'POST', body: { reason: 'injury' } }),
    );
  });

  it('marks an alert handled and refreshes alerts and counters', async () => {
    mockApi();
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar gestionado' }));
    expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/a1/handle', { method: 'POST' });
    await waitFor(() => expect(apiFetch.mock.calls.filter(([path]) => path === '/staff/alerts/counts').length).toBe(2));
    expect(apiFetch.mock.calls.filter(([path]) => path === '/staff/alerts').length).toBe(2);
  });

  it('shows the contract message when the action fails', async () => {
    mockApi({ 'POST /staff/alerts/a1/handle': () => Promise.reject(new ApiError(409, 'ALERT_ALREADY_HANDLED', 'x')) });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar gestionado' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('La alerta ya fue gestionada.'));
  });

  it('runs the detection job on demand', async () => {
    mockApi({ 'POST /staff/automations/run/followup-detect': () => Promise.resolve({ job: 'followup-detect', ran: true, result: {} }) });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Ejecutar detección ahora' }));
    expect(apiFetch).toHaveBeenCalledWith('/staff/automations/run/followup-detect', { method: 'POST' });
  });
});

describe('isAlertType', () => {
  it('accepts real alert types and rejects inherited property names', async () => {
    const { isAlertType } = await import('./alert-labels');
    expect(isAlertType('expiring')).toBe(true);
    expect(isAlertType('constructor')).toBe(false);
    expect(isAlertType('toString')).toBe(false);
    expect(isAlertType(null)).toBe(false);
  });
});

describe('FollowupView with an unknown filter', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    search = 'tipo=constructor';
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('falls back to all the alerts', async () => {
    mockApi();
    renderView();
    expect(await screen.findByText('Federico Álvez')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/staff/alerts', { query: { status: 'open' } });
    expect(screen.getByRole('button', { name: 'Todas · 23' })).toHaveAttribute('aria-pressed', 'true');
  });
});
