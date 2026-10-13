import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckinResponseDto, CheckinStatsDto } from '@/lib/api/types';
import { ResponseCard } from './response-card';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: toastSuccess, info: vi.fn() } }));

const { CheckinsView } = await import('./checkins-view');

const response = (over: Partial<CheckinResponseDto>): CheckinResponseDto => ({
  id: 'k1', client: { id: 'c1', name: 'Martina Suárez' }, period: '2026-10', feeling: 'good', pain: 'mild',
  painDetail: 'Molestia en hombro izquierdo al hacer press', goals: 'same', goalsDetail: null, flag: 'pain',
  respondedAt: '2026-10-12T12:42:00.000Z', frequencyPerWeek: 3.2, planName: 'Trimestral', alertId: 'al1', alertStatus: 'open', ...over,
});

const handlers = { onContact: vi.fn(), onRefer: vi.fn(), onHandle: vi.fn() };

describe('ResponseCard', () => {
  it('shows the pain quote and offers to refer to Rehab', () => {
    render(<ResponseCard response={response({})} today="2026-10-12" {...handlers} />);
    expect(screen.getByText('Molestia reportada')).toBeInTheDocument();
    expect(screen.getByText('“Molestia en hombro izquierdo al hacer press”')).toBeInTheDocument();
    expect(screen.getByText('Respondió hoy 09:42 · entrena 3.2 /sem · plan Trimestral')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contactar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Derivar a Rehab' })).toBeInTheDocument();
  });

  it('does not offer Rehab for a goals change but lets staff mark it handled', () => {
    render(
      <ResponseCard
        response={response({ flag: 'goals', pain: 'none', painDetail: null, goals: 'adjust', goalsDetail: 'Quiero preparar una maratón' })}
        today="2026-10-13" {...handlers}
      />,
    );
    expect(screen.getByText('Cambio de objetivos')).toBeInTheDocument();
    expect(screen.getByText('Respondió ayer 09:42 · entrena 3.2 /sem · plan Trimestral')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Derivar a Rehab' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar gestionado' })).toBeInTheDocument();
  });

  it('shows an all-good response with a link to the profile', () => {
    render(
      <ResponseCard
        response={response({ flag: 'ok', pain: 'none', painDetail: null, alertId: null, alertStatus: null })}
        today="2026-10-20" {...handlers}
      />,
    );
    expect(screen.getByText('Todo bien')).toBeInTheDocument();
    expect(screen.getByText(/Respondió 12\/10 09:42/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver perfil' })).toHaveAttribute('href', '/staff/clientes/c1');
    expect(screen.queryByRole('button', { name: 'Derivar a Rehab' })).not.toBeInTheDocument();
  });

  it('shows a referred response with the button disabled', () => {
    render(<ResponseCard response={response({})} today="2026-10-12" referred {...handlers} />);
    expect(screen.getByRole('button', { name: 'Derivado a Rehab' })).toBeDisabled();
  });
});

const STATS: CheckinStatsDto = { period: '2026-10', sent: 48, answered: 31, needsIntervention: 5 };

function mockApi(responses: CheckinResponseDto[]) {
  apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    const key = `${init?.method ?? 'GET'} ${path}`;
    if (key === 'GET /staff/checkins/stats') return Promise.resolve(STATS);
    if (key === 'GET /staff/checkins/responses') return Promise.resolve(responses);
    if (key === 'POST /staff/checkins/send') return Promise.resolve({ sent: 12, period: '2026-10' });
    if (key === 'POST /staff/checkins/k1/refer-rehab') return Promise.resolve(response({}));
    return Promise.reject(new Error(`unexpected ${key}`));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckinsView />
    </QueryClientProvider>,
  );
}

describe('CheckinsView', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the monthly numbers', async () => {
    mockApi([]);
    renderView();
    expect(await screen.findByRole('group', { name: 'Enviados' })).toHaveTextContent('48');
    expect(screen.getByRole('group', { name: 'Respondidos' })).toHaveTextContent('31');
    expect(screen.getByRole('group', { name: 'Requieren intervención' })).toHaveTextContent('5');
  });

  it('sends the check-ins and reports how many went out', async () => {
    mockApi([]);
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar check-in' }));
    expect(apiFetch).toHaveBeenCalledWith('/staff/checkins/send', { method: 'POST' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Enviamos 12 check-ins'));
  });

  it('refers a pain response to Rehab, refreshes the list and blocks a second referral', async () => {
    mockApi([response({})]);
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Derivar a Rehab' }));
    expect(apiFetch).toHaveBeenCalledWith('/staff/checkins/k1/refer-rehab', { method: 'POST' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Derivado a Rehab'));
    await waitFor(() => expect(apiFetch.mock.calls.filter(([path]) => path === '/staff/checkins/responses').length).toBe(2));
    expect(screen.getByRole('button', { name: 'Derivado a Rehab' })).toBeDisabled();
  });
});
