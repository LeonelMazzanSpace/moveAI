import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { CheckinResponseDto, CheckinStatsDto } from '@/lib/api/types';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess, info: vi.fn() } }));

const { CheckinsView } = await import('./checkins-view');

const STATS: CheckinStatsDto = { period: '2026-10', sent: 48, answered: 31, needsIntervention: 5 };

const response = (over: Partial<CheckinResponseDto> = {}): CheckinResponseDto => ({
  id: 'k1', client: { id: 'c1', name: 'Martina Suárez' }, period: '2026-10', feeling: 'good', pain: 'mild',
  painDetail: 'Molestia en hombro izquierdo', goals: 'same', goalsDetail: null, flag: 'pain',
  respondedAt: '2026-10-12T12:42:00.000Z', frequencyPerWeek: 3.2, planName: 'Trimestral', alertId: 'al1', alertStatus: 'open', ...over,
});

type Handler = (init?: { method?: string }) => Promise<unknown>;

function mockApi(overrides: Record<string, Handler> = {}, responses: CheckinResponseDto[] = [response()]) {
  apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    if (overrides[key]) return overrides[key](init);
    if (key === 'GET /staff/checkins/stats') return Promise.resolve(STATS);
    if (key === 'GET /staff/checkins/responses') return Promise.resolve(responses);
    if (key.startsWith('POST ')) return Promise.resolve({});
    return Promise.reject(new Error(`unexpected ${key}`));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(['staff', 'alert-counts'], { total: 3 });
  render(
    <QueryClientProvider client={queryClient}>
      <CheckinsView />
    </QueryClientProvider>,
  );
  return queryClient;
}

const callsTo = (path: string) => apiFetch.mock.calls.filter(([p, init]) => p === path && !init?.method).length;

describe('CheckinsView', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('shows an error state for the stats with a retry that reloads them', async () => {
    let failing = true;
    mockApi({ 'GET /staff/checkins/stats': () => (failing ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : Promise.resolve(STATS)) });
    renderView();
    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('group', { name: 'Enviados' })).toHaveTextContent('48');
  });

  it('shows an error state for the responses', async () => {
    mockApi({ 'GET /staff/checkins/responses': () => Promise.reject(new ApiError(403, 'FORBIDDEN', 'x')) });
    renderView();
    expect(await screen.findByText('No tenés permiso para esta acción.')).toBeInTheDocument();
  });

  it('shows the empty state when nobody answered', async () => {
    mockApi({}, []);
    renderView();
    expect(await screen.findByText('Sin respuestas')).toBeInTheDocument();
  });

  it('sends the check-ins, reports one in the singular and refreshes stats, responses and the sidebar counters', async () => {
    mockApi({ 'POST /staff/checkins/send': () => Promise.resolve({ sent: 1, period: '2026-10' }) });
    const queryClient = renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar check-in' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Enviamos 1 check-in'));
    await waitFor(() => expect(callsTo('/staff/checkins/stats')).toBe(2));
    expect(callsTo('/staff/checkins/responses')).toBe(2);
    expect(queryClient.getQueryState(['staff', 'alert-counts'])?.isInvalidated).toBe(true);
  });

  it('shows the contract message when sending fails and lets staff try again', async () => {
    mockApi({ 'POST /staff/checkins/send': () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) });
    renderView();
    const send = await screen.findByRole('button', { name: 'Enviar check-in' });
    await userEvent.click(send);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Ocurrió un error inesperado.'));
    expect(send).toBeEnabled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('blocks a second send while the first one is pending', async () => {
    let release: () => void = () => undefined;
    mockApi({ 'POST /staff/checkins/send': () => new Promise((resolve) => { release = () => resolve({ sent: 2, period: '2026-10' }); }) });
    renderView();
    const send = await screen.findByRole('button', { name: 'Enviar check-in' });
    await userEvent.click(send);
    await waitFor(() => expect(send).toBeDisabled());
    await userEvent.click(send);
    expect(apiFetch.mock.calls.filter(([path]) => path === '/staff/checkins/send').length).toBe(1);
    release();
    await waitFor(() => expect(send).toBeEnabled());
  });

  it('does not mark a response as referred when the referral fails', async () => {
    mockApi({ 'POST /staff/checkins/k1/refer-rehab': () => Promise.reject(new ApiError(404, 'CHECKIN_NOT_FOUND', 'x')) });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Derivar a Rehab' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('El check-in no existe.'));
    expect(screen.getByRole('button', { name: 'Derivar a Rehab' })).toBeEnabled();
  });

  it('marks the alert of a response as handled and refreshes the list', async () => {
    mockApi({}, [response({ flag: 'goals', pain: 'none', painDetail: null, goals: 'adjust', goalsDetail: 'Quiero preparar una maratón' })]);
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar gestionado' }));
    expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/al1/handle', { method: 'POST' });
    await waitFor(() => expect(callsTo('/staff/checkins/responses')).toBe(2));
  });

  it('records a contact for the alert of a response', async () => {
    mockApi();
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Contactar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Contactar a Martina Suárez')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/al1/contacts', { method: 'POST', body: { channel: 'whatsapp', outcome: 'reached' } }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(callsTo('/staff/checkins/responses')).toBe(2));
  });
});
