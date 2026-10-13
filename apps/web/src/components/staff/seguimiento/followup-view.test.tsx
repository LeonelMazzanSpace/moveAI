import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  render(
    <QueryClientProvider client={queryClient}>
      <FollowupView />
    </QueryClientProvider>,
  );
  return queryClient;
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

const callsTo = (path: string, method?: string) =>
  apiFetch.mock.calls.filter(([p, init]) => p === path && (init?.method ?? undefined) === method).length;

describe('FollowupView counters', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    toastError.mockReset();
    search = '';
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('shares the counters key with the sidebar so one request feeds both', async () => {
    mockApi();
    const queryClient = renderView();
    expect(await screen.findByRole('button', { name: 'Todas · 23' })).toBeInTheDocument();
    expect(queryClient.getQueryData(['staff', 'alert-counts'])).toEqual(COUNTS);
    expect(queryClient.getQueryData(['staff', 'alerts', 'counts'])).toBeUndefined();
  });

  it('shows an error state for the counters, still lists alerts and retries', async () => {
    let failing = true;
    mockApi({
      'GET /staff/alerts/counts': () => (failing ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : Promise.resolve(COUNTS)),
    });
    renderView();
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No pudimos cargar los contadores.');
    expect(await screen.findByText('Federico Álvez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por vencer' })).toBeInTheDocument();
    failing = false;
    await userEvent.click(within(error).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Por vencer · 12' })).toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar los contadores.')).not.toBeInTheDocument();
  });

  it('shows the contract message when the detection fails', async () => {
    mockApi({ 'POST /staff/automations/run/followup-detect': () => Promise.reject(new ApiError(404, 'JOB_UNKNOWN', 'x')) });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Ejecutar detección ahora' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('La automatización no existe.'));
  });

  it('refreshes alerts, counters and check-ins after running the detection', async () => {
    mockApi({ 'POST /staff/automations/run/followup-detect': () => Promise.resolve({ job: 'followup-detect', ran: true, result: {} }) });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Ejecutar detección ahora' }));
    await waitFor(() => expect(callsTo('/staff/alerts/counts')).toBe(2));
    expect(callsTo('/staff/alerts')).toBe(2);
  });
});

describe('FollowupView contact dialog', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    toastError.mockReset();
    search = '';
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  async function openDialog() {
    await userEvent.click(await screen.findByRole('button', { name: 'Contactar' }));
    return screen.findByRole('dialog');
  }

  it('sends the default channel and outcome without a note', async () => {
    mockApi();
    renderView();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/a1/contacts', { method: 'POST', body: { channel: 'whatsapp', outcome: 'reached' } }),
    );
  });

  it('trims the note before sending it', async () => {
    mockApi();
    renderView();
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Nota'), { target: { value: '   Llamar el lunes   ' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/a1/contacts', {
        method: 'POST',
        body: { channel: 'whatsapp', outcome: 'reached', note: 'Llamar el lunes' },
      }),
    );
  });

  it('rejects a note over 1000 characters without calling the API', async () => {
    mockApi();
    renderView();
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Nota'), { target: { value: 'x'.repeat(1001) } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    expect(await within(dialog).findByText('La nota es demasiado larga (máximo 1000 caracteres).')).toBeInTheDocument();
    expect(callsTo('/staff/alerts/a1/contacts', 'POST')).toBe(0);
  });

  it('shows the API field errors under the note and keeps the dialog open', async () => {
    mockApi({
      'POST /staff/alerts/a1/contacts': () =>
        Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'note', messages: ['La nota no es válida.'] }])),
    });
    renderView();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    expect(await within(dialog).findByText('La nota no es válida.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nota')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the contract message for other API errors and keeps the dialog open', async () => {
    mockApi({ 'POST /staff/alerts/a1/contacts': () => Promise.reject(new ApiError(404, 'ALERT_NOT_FOUND', 'x')) });
    renderView();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar contacto' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La alerta no existe.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes after saving, refreshes the counters and blocks a second submit while it is pending', async () => {
    let release: () => void = () => undefined;
    mockApi({ 'POST /staff/alerts/a1/contacts': () => new Promise((resolve) => { release = () => resolve({}); }) });
    renderView();
    const dialog = await openDialog();
    const save = within(dialog).getByRole('button', { name: 'Guardar contacto' });
    await userEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    await userEvent.click(save);
    expect(callsTo('/staff/alerts/a1/contacts', 'POST')).toBe(1);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(callsTo('/staff/alerts/counts')).toBe(2));
  });
});

describe('FollowupView reason panel', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    toastError.mockReset();
    search = '';
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  async function openPanel() {
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar motivo' }));
  }

  it('requires a reason and a re-contact date that is not in the past', async () => {
    mockApi({ 'GET /staff/alerts': () => Promise.resolve([alert({ type: 'expired' })]) });
    renderView();
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Elegí un motivo.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    fireEvent.change(screen.getByLabelText('Fecha de re-contacto'), { target: { value: '2026-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('La fecha de re-contacto no puede ser anterior a hoy.')).toBeInTheDocument();
    expect(callsTo('/staff/clients/c1/inactivity-reasons', 'POST')).toBe(0);
  });

  it('sends the trimmed note and the date, then closes the panel and refreshes the counters', async () => {
    mockApi({ 'GET /staff/alerts': () => Promise.resolve([alert({ type: 'expired' })]) });
    renderView();
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Vacaciones' }));
    fireEvent.change(screen.getByLabelText('Nota interna (opcional)'), { target: { value: '  Vuelve en noviembre  ' } });
    fireEvent.change(screen.getByLabelText('Fecha de re-contacto'), { target: { value: '2026-11-02' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/inactivity-reasons', {
        method: 'POST',
        body: { reason: 'vacation', note: 'Vuelve en noviembre', recontactOn: '2026-11-02' },
      }),
    );
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Motivo' })).not.toBeInTheDocument());
    expect(callsTo('/staff/alerts/counts')).toBe(2);
  });

  it('shows the API field errors in their fields and keeps the panel open', async () => {
    mockApi({
      'GET /staff/alerts': () => Promise.resolve([alert({ type: 'expired' })]),
      'POST /staff/clients/c1/inactivity-reasons': () =>
        Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'recontactOn', messages: ['La fecha no es válida.'] }])),
    });
    renderView();
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('La fecha no es válida.')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de re-contacto')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('group', { name: 'Motivo' })).toBeInTheDocument();
  });

  it('shows the contract message when the client already has a pause', async () => {
    mockApi({
      'GET /staff/alerts': () => Promise.resolve([alert({ type: 'expired' })]),
      'POST /staff/clients/c1/inactivity-reasons': () => Promise.reject(new ApiError(409, 'PAUSE_ALREADY_ACTIVE', 'x')),
    });
    renderView();
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente ya tiene una pausa activa.');
    await waitFor(() => expect(callsTo('/staff/alerts')).toBe(2));
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
