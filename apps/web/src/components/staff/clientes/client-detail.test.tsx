import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AutoDebitDto, ClientDetailDto, InactivityReasonDto } from '@/lib/api/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

const { ClientDetail } = await import('./client-detail');

const PAUSE: InactivityReasonDto = {
  id: 'r1', reason: 'injury', note: 'Se lesionó la rodilla', recontactOn: '2026-11-01',
  startedAt: '2026-10-05T15:00:00.000Z', endedAt: null, createdByName: 'Juan Pérez',
};

const detail = (over: Partial<ClientDetailDto> = {}): ClientDetailDto => ({
  client: {
    id: 'c1', name: 'Martina Suárez', email: 'martina@gmail.com', phone: '099123456', status: 'active', pauseReason: null,
    planName: 'Plan Trimestral', endsOn: '2026-11-15', paymentStatus: 'up_to_date', lastAttendanceOn: '2026-10-10',
    frequencyPerWeek: 3.2, rehabCount: 0, recoveryCount: 4, rehabFollowupEnabled: false, createdAt: '2026-08-15T12:00:00.000Z',
  },
  subscription: {
    id: 's1', planId: 'p1', planName: 'Plan Trimestral', service: 'performance', startsOn: '2026-08-15', endsOn: '2026-11-15',
    status: 'active', daysLeft: 34, progressPct: 63,
  },
  upcomingSubscription: null,
  recoveryPacks: [{ id: 'k1', planId: 'p2', planName: 'Pack 4 sesiones', startsOn: '2026-10-01', endsOn: '2026-10-30', sessionsTotal: 4, sessionsUsed: 1, sessionsLeft: 3 }],
  metrics: { lastAttendanceOn: '2026-10-10', frequencyPerWeek: 3.2, attendancesThisMonth: 6, cancellations: 1, noShows: 2, rehabCount: 0, recoveryCount: 4 },
  activePause: null,
  contacts: [{ id: 'ct1', channel: 'whatsapp', outcome: 'reached', note: 'Volvía la semana próxima', staffName: 'Juan Pérez', alertType: 'no_attendance', createdAt: '2026-10-08T14:00:00.000Z' }],
  reasons: [],
  history: [{ type: 'payment', label: 'Pago Plan Trimestral', date: '2026-08-15T12:00:00.000Z', amount: 9900, service: 'performance' }],
  upcomingBookings: [{
    id: 'b1', timeSlotId: 's9', service: 'performance', startsAt: '2026-10-14T21:00:00.000Z', endsAt: '2026-10-14T22:00:00.000Z', durationMinutes: 60,
    label: 'Entrenamiento semi personalizado', status: 'confirmed', source: 'plan', attendance: null, canCancel: true, cancelledAt: null,
  }],
  autoDebits: [],
  ...over,
});

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientDetail id="c1" />
    </QueryClientProvider>,
  );
}

function mockApi(data: ClientDetailDto, onMutation?: (path: string, init: { method?: string; body?: unknown }) => unknown) {
  apiFetch.mockImplementation((path: string, init?: { method?: string; body?: unknown }) => {
    if (path === '/staff/clients/c1' && !init?.method) return Promise.resolve(data);
    if (init?.method && onMutation) return Promise.resolve(onMutation(path, init));
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

describe('ClientDetail', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-13T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the header, plan, packs, metrics, contacts, bookings and history', async () => {
    mockApi(detail());
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Martina Suárez' })).toBeInTheDocument();
    expect(screen.getByText('martina@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('099123456')).toBeInTheDocument();
    expect(screen.getByText('Plan Trimestral', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Vence el 15/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Pack 4 sesiones')).toBeInTheDocument();
    expect(screen.getByText('3 de 4 sesiones')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Asistencias este mes' })).toHaveTextContent('6');
    expect(screen.getByText('WhatsApp · Contactado')).toBeInTheDocument();
    expect(screen.getByText('Entrenamiento semi personalizado')).toBeInTheDocument();
    expect(screen.getByText('Pago Plan Trimestral')).toBeInTheDocument();
    expect(screen.getByText('$ 9.900')).toBeInTheDocument();
  });

  it('shows the contract message when the client does not exist', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'CLIENT_NOT_FOUND', 'x'));
    renderDetail();
    expect(await screen.findByText('El cliente no existe.')).toBeInTheDocument();
  });

  it('ends the active pause after confirming', async () => {
    mockApi(detail({ activePause: PAUSE, client: { ...detail().client, status: 'paused', pauseReason: 'injury' } }), () => ({ ...PAUSE, endedAt: '2026-10-13T15:00:00.000Z' }));
    renderDetail();
    expect(await screen.findByText('Pausa — Lesión', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Se lesionó la rodilla')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar pausa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/inactivity-reasons/end', { method: 'POST' }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Pausa finalizada'));
  });

  it('shows the contract error when ending the pause fails', async () => {
    apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method) return Promise.reject(new ApiError(409, 'NO_ACTIVE_PAUSE', 'x'));
      return Promise.resolve(detail({ activePause: PAUSE }));
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar pausa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar' }));
    expect(await screen.findByText('El cliente no tiene una pausa activa.')).toBeInTheDocument();
  });

  it('registers a reason with a re-contact date', async () => {
    mockApi(detail(), () => ({ ...PAUSE, reason: 'vacation' }));
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Vacaciones' }));
    fireEvent.change(screen.getByLabelText('Fecha de re-contacto'), { target: { value: '2026-11-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/inactivity-reasons', {
        method: 'POST',
        body: { reason: 'vacation', recontactOn: '2026-11-01' },
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Motivo registrado'));
  });

  it('requires a reason and a future re-contact date', async () => {
    mockApi(detail());
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('Elegí un motivo.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    fireEvent.change(screen.getByLabelText('Fecha de re-contacto'), { target: { value: '2026-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('La fecha de re-contacto no puede ser anterior a hoy.')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('toggles the physiotherapy follow-up', async () => {
    mockApi(detail(), () => detail().client);
    renderDetail();
    const toggle = await screen.findByRole('switch', { name: 'Seguimiento fisioterapéutico habilitado' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/rehab-followup', { method: 'PATCH', body: { enabled: true } }),
    );
  });

  it('reports a failed toggle with the contract message', async () => {
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) => {
      if (init?.method) return Promise.reject(new ApiError(404, 'CLIENT_NOT_FOUND', 'x'));
      return Promise.resolve(detail());
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('switch', { name: 'Seguimiento fisioterapéutico habilitado' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('El cliente no existe.'));
    expect(screen.getByRole('switch', { name: 'Seguimiento fisioterapéutico habilitado' })).toHaveAttribute('aria-checked', 'false');
  });
});

const detailGets = (id = 'c1') => apiFetch.mock.calls.filter(([path, init]) => path === `/staff/clients/${id}` && !init?.method).length;

describe('ClientDetail refresh, ids and validation', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-13T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('encodes the client id in every request path', async () => {
    const id = 'a/b c?x';
    const encoded = encodeURIComponent(id);
    const withPause = detail({ activePause: PAUSE, client: { ...detail().client, id } });
    apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (!init?.method) return Promise.resolve(withPause);
      return Promise.resolve({});
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}>
        <ClientDetail id={id} />
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole('switch', { name: 'Seguimiento fisioterapéutico habilitado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar pausa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Pausa finalizada'));
    expect(apiFetch).toHaveBeenCalledWith(`/staff/clients/${encoded}`);
    expect(apiFetch).toHaveBeenCalledWith(`/staff/clients/${encoded}/rehab-followup`, { method: 'PATCH', body: { enabled: true } });
    expect(apiFetch).toHaveBeenCalledWith(`/staff/clients/${encoded}/inactivity-reasons/end`, { method: 'POST' });
  });

  it('encodes the client id when registering an inactivity reason', async () => {
    const id = 'a/b c?x';
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) =>
      Promise.resolve(init?.method ? {} : detail({ client: { ...detail().client, id } })),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}>
        <ClientDetail id={id} />
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/staff/clients/${encodeURIComponent(id)}/inactivity-reasons`, { method: 'POST', body: { reason: 'injury' } }),
    );
  });

  it('reloads the detail after ending a pause', async () => {
    mockApi(detail({ activePause: PAUSE }), () => ({ ...PAUSE, endedAt: '2026-10-13T15:00:00.000Z' }));
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar pausa' }));
    expect(detailGets()).toBe(1);
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar' }));
    await waitFor(() => expect(detailGets()).toBe(2));
  });

  it('reloads the detail after registering a reason', async () => {
    mockApi(detail(), () => ({ ...PAUSE, reason: 'vacation' }));
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Vacaciones' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Motivo registrado'));
    expect(detailGets()).toBe(2);
  });

  it('reloads the detail after toggling the follow-up', async () => {
    mockApi(detail(), () => detail().client);
    renderDetail();
    await userEvent.click(await screen.findByRole('switch', { name: 'Seguimiento fisioterapéutico habilitado' }));
    await waitFor(() => expect(detailGets()).toBe(2));
  });

  it('reloads a stale screen when the pause was already ended elsewhere (NO_ACTIVE_PAUSE)', async () => {
    let gets = 0;
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) => {
      if (init?.method) return Promise.reject(new ApiError(409, 'NO_ACTIVE_PAUSE', 'x'));
      gets += 1;
      return Promise.resolve(detail({ activePause: gets === 1 ? PAUSE : null }));
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar pausa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar' }));
    await waitFor(() => expect(detailGets()).toBe(2));
    expect(await screen.findByRole('button', { name: 'Registrar motivo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar pausa' })).not.toBeInTheDocument();
  });

  it('reloads a stale screen when a pause already exists (PAUSE_ALREADY_ACTIVE)', async () => {
    let gets = 0;
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) => {
      if (init?.method) return Promise.reject(new ApiError(409, 'PAUSE_ALREADY_ACTIVE', 'x'));
      gets += 1;
      return Promise.resolve(detail({ activePause: gets === 1 ? null : PAUSE }));
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() => expect(detailGets()).toBe(2));
    expect(await screen.findByRole('button', { name: 'Finalizar pausa' })).toBeInTheDocument();
  });

  it('does not reload the detail for other errors', async () => {
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) => {
      if (init?.method) return Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x'));
      return Promise.resolve(detail({ activePause: PAUSE }));
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar pausa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar' }));
    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    expect(detailGets()).toBe(1);
  });

  it('rejects a note over 1000 characters and trims a padded one', async () => {
    mockApi(detail(), () => ({ ...PAUSE }));
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Lesión' }));
    fireEvent.change(screen.getByLabelText('Nota interna (opcional)'), { target: { value: 'x'.repeat(1001) } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('La nota es demasiado larga (máximo 1000 caracteres).')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Nota interna (opcional)'), { target: { value: '   Se fue de viaje   ' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/inactivity-reasons', {
        method: 'POST',
        body: { reason: 'injury', note: 'Se fue de viaje' },
      }),
    );
  });

  it('shows the API field errors under their fields', async () => {
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) => {
      if (init?.method) {
        return Promise.reject(
          new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'recontactOn', messages: ['recontactOn must be today or later', 'recontactOn must be a valid ISO 8601 date string'] }, { field: 'note', messages: ['note must be shorter than or equal to 1000 characters'] }]),
        );
      }
      return Promise.resolve(detail());
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('La fecha de re-contacto no es válida.')).toBeInTheDocument();
    expect(screen.queryByText(/must/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de re-contacto')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('La nota no es válida.')).toBeInTheDocument();
    expect(screen.queryByText('Los datos enviados no son válidos.')).not.toBeInTheDocument();
  });

  it('shows an API error without field details above the form', async () => {
    apiFetch.mockImplementation((_path: string, init?: { method?: string }) => {
      if (init?.method) return Promise.reject(new ApiError(404, 'CLIENT_NOT_FOUND', 'x'));
      return Promise.resolve(detail());
    });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente no existe.');
  });
});

const debitOf = (over: Partial<AutoDebitDto> = {}): AutoDebitDto => ({
  id: 'd1', planId: 'p9', planName: 'Plan Mensual Débito', planSlug: 'performance-mensual', service: 'performance', status: 'authorized',
  amount: 3900, frequency: 1, frequencyType: 'months', nextChargeDate: '2026-11-15', createdAt: '2026-10-01T12:00:00.000Z',
  cancelledAt: null, cancelReason: null, ...over,
});

describe('ClientDetail automatic debits', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-13T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('says the client has no debits', async () => {
    mockApi(detail());
    renderDetail();

    expect(await screen.findByText('Sin débitos automáticos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar débito' })).toBeNull();
  });

  it('lists each debit with its status, plan, amount, next charge and cancel reason', async () => {
    mockApi(
      detail({
        autoDebits: [
          debitOf(),
          debitOf({ id: 'd2', planName: 'Paquete 4 Débito', service: 'recovery', status: 'pending', nextChargeDate: null, frequency: 30, frequencyType: 'days', amount: 3200 }),
          debitOf({ id: 'd3', planName: 'Plan Viejo Débito', status: 'cancelled', cancelledAt: '2026-09-20T12:00:00.000Z', cancelReason: 'staff', nextChargeDate: null }),
          debitOf({ id: 'd4', planName: 'Plan Vencido Débito', status: 'cancelled', cancelledAt: '2026-09-21T12:00:00.000Z', cancelReason: 'expired', nextChargeDate: null }),
          debitOf({ id: 'd5', planName: 'Plan Proveedor Débito', status: 'cancelled', cancelledAt: '2026-09-22T12:00:00.000Z', cancelReason: 'provider', nextChargeDate: null }),
          debitOf({ id: 'd6', planName: 'Plan Cliente Débito', status: 'cancelled', cancelledAt: '2026-09-23T12:00:00.000Z', cancelReason: 'client', nextChargeDate: null }),
        ],
      }),
    );
    renderDetail();

    const active = (await screen.findByText('Plan Mensual Débito')).closest('li') as HTMLElement;
    expect(within(active).getByText('Activo')).toBeInTheDocument();
    expect(within(active).getByText('$ 3.900 · cada mes')).toBeInTheDocument();
    expect(within(active).getByText('Próximo cobro: 15/11/2026')).toBeInTheDocument();
    expect(within(active).getByRole('button', { name: 'Cancelar débito' })).toBeInTheDocument();

    const pending = screen.getByText('Paquete 4 Débito').closest('li') as HTMLElement;
    expect(within(pending).getByText('Pendiente de autorización')).toBeInTheDocument();
    expect(within(pending).getByText('$ 3.200 · cada 30 días')).toBeInTheDocument();
    expect(within(pending).queryByText(/Próximo cobro/)).toBeNull();
    expect(within(pending).getByRole('button', { name: 'Cancelar débito' })).toBeInTheDocument();

    const reasons: [string, string][] = [
      ['Plan Viejo Débito', 'Lo canceló el staff'],
      ['Plan Vencido Débito', 'Venció sin autorizarse'],
      ['Plan Proveedor Débito', 'Lo canceló Mercado Pago'],
      ['Plan Cliente Débito', 'Lo canceló el cliente'],
    ];
    for (const [name, reason] of reasons) {
      const row = screen.getByText(name).closest('li') as HTMLElement;
      expect(within(row).getByText('Cancelado')).toBeInTheDocument();
      expect(within(row).getByText(reason)).toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: 'Cancelar débito' })).toBeNull();
    }
    expect(screen.getAllByRole('button', { name: 'Cancelar débito' })).toHaveLength(2);
  });

  it('asks for confirmation before cancelling a debit and does not call the API until then', async () => {
    mockApi(detail({ autoDebits: [debitOf()] }));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));

    expect(await screen.findByText('Lo que ya pagó sigue vigente. Mercado Pago deja de cobrar los próximos ciclos.')).toBeInTheDocument();
    expect(apiFetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByText(/Lo que ya pagó sigue vigente/)).toBeNull());
    expect(apiFetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('cancels the debit through the staff endpoint, refreshes the client and confirms with a toast', async () => {
    let cancelled = false;
    apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === '/staff/clients/c1/auto-debits/d1/cancel' && init?.method === 'POST') {
        cancelled = true;
        return Promise.resolve(debitOf({ status: 'cancelled', cancelReason: 'staff', cancelledAt: '2026-10-13T15:00:00.000Z', nextChargeDate: null }));
      }
      if (path === '/staff/clients/c1') {
        return Promise.resolve(detail({ autoDebits: [cancelled ? debitOf({ status: 'cancelled', cancelReason: 'staff', nextChargeDate: null }) : debitOf()] }));
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ClientDetail id="c1" />
      </QueryClientProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/staff/clients/c1/auto-debits/d1/cancel', { method: 'POST' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Débito automático cancelado'));
    expect(await screen.findByText('Lo canceló el staff')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar débito' })).toBeNull();
  });

  it('shows a recoverable error when Mercado Pago fails to cancel and keeps the debit active', async () => {
    apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return Promise.reject(new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'x'));
      return Promise.resolve(detail({ autoDebits: [debitOf()] }));
    });
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cancelar el débito en Mercado Pago. Sigue activo: probá de nuevo en unos minutos.',
    );
    expect(screen.getByRole('button', { name: 'Sí, cancelar débito' })).toBeEnabled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('shows the contract message when the debit does not belong to the client', async () => {
    apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return Promise.reject(new ApiError(404, 'AUTO_DEBIT_NOT_FOUND', 'x'));
      return Promise.resolve(detail({ autoDebits: [debitOf()] }));
    });
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar débito' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar débito' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos ese débito automático.');
  });
});
