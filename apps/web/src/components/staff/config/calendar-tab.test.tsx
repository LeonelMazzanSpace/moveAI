import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { CalendarStatusDto, GoogleCalendarOptionDto } from '@/lib/api/types';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError, info: vi.fn() } }));

const { CalendarTab } = await import('./calendar-tab');

const status = (over: Partial<CalendarStatusDto>): CalendarStatusDto => ({
  configured: true, status: 'disconnected', accountEmail: null, calendarId: null, calendarName: null,
  lastPushAt: null, lastPullAt: null, ...over,
});

const CONNECTED = status({
  status: 'connected', accountEmail: 'move@example.com', calendarId: 'cal-1', calendarName: 'MOVE Rehab',
  lastPushAt: '2026-10-14T12:00:00.000Z', lastPullAt: '2026-10-14T13:05:00.000Z',
});
const CONNECTED_WITHOUT_CALENDAR = status({ status: 'connected', accountEmail: 'move@example.com' });
const NEEDS_RECONNECT = status({ status: 'needs_reconnect', accountEmail: 'move@example.com' });

const CALENDARS: GoogleCalendarOptionDto[] = [
  { id: 'cal-1', name: 'MOVE Rehab', primary: false },
  { id: 'cal-2', name: 'move@example.com', primary: true },
];

const assign = vi.fn();
let client: QueryClient;

function mockApi(current: CalendarStatusDto, overrides: Record<string, () => Promise<unknown>> = {}) {
  apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    const handler = overrides[`${init?.method ?? 'GET'} ${path}`];
    if (handler) return handler();
    if (path === '/staff/calendar' && (init?.method ?? 'GET') === 'GET') return Promise.resolve(current);
    if (path === '/staff/calendar/calendars') return Promise.resolve(CALENDARS);
    return Promise.reject(new Error(`unexpected ${init?.method ?? 'GET'} ${path}`));
  });
}

function renderTab() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalendarTab />
    </QueryClientProvider>,
  );
}

const callsTo = (method: string, path: string) =>
  apiFetch.mock.calls.filter(([calledPath, init]) => calledPath === path && (init?.method ?? 'GET') === method);

describe('CalendarTab', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    replace.mockReset();
    assign.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    search = '';
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('states', () => {
    it('explains what is missing on the server when Google is not configured, without offering to connect', async () => {
      mockApi(status({ configured: false }));
      renderTab();
      expect(
        await screen.findByText('Falta configurar Google en el servidor: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y CALENDAR_TOKEN_KEY.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Conectar Google Calendar' })).toBeNull();
    });

    it('offers to connect when there is no connection', async () => {
      mockApi(status({}));
      renderTab();
      expect(await screen.findByRole('button', { name: 'Conectar Google Calendar' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Desconectar' })).toBeNull();
    });

    it('lets staff pick the calendar when connected without one, listing only what the API returns', async () => {
      mockApi(CONNECTED_WITHOUT_CALENDAR);
      renderTab();
      const select = await screen.findByLabelText('Calendario de MOVE');
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Elegí un calendario',
        'MOVE Rehab',
        'move@example.com (principal)',
      ]);
      expect(screen.getByText('move@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).toBeNull();
    });

    it('shows the account, the calendar and the last synchronization when connected', async () => {
      mockApi(CONNECTED);
      renderTab();
      expect(await screen.findByText('MOVE Rehab')).toBeInTheDocument();
      expect(screen.getByText('move@example.com')).toBeInTheDocument();
      expect(screen.getByText('Última sincronización')).toBeInTheDocument();
      expect(screen.getByText('14/10/2026 10:05')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Desconectar' })).toBeEnabled();
      expect(screen.queryByLabelText('Calendario de MOVE')).toBeNull();
    });

    it('says it never synchronized when there is no sync date yet', async () => {
      mockApi({ ...CONNECTED, lastPushAt: null, lastPullAt: null });
      renderTab();
      expect(await screen.findByText('Todavía no sincronizó')).toBeInTheDocument();
    });

    it('warns and offers to reconnect when Google access was lost', async () => {
      mockApi(NEEDS_RECONNECT);
      renderTab();
      expect(await screen.findByText(/Perdimos el acceso a Google Calendar/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reconectar' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).toBeNull();
    });

    it('shows a loading skeleton and then an error with retry when the status cannot be read', async () => {
      apiFetch.mockRejectedValueOnce(new ApiError(502, 'CALENDAR_PROVIDER_ERROR', 'Bad gateway'));
      renderTab();
      expect(await screen.findByText('Google Calendar no respondió. Probá de nuevo en un rato.')).toBeInTheDocument();
      apiFetch.mockResolvedValueOnce(status({}));
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('button', { name: 'Conectar Google Calendar' })).toBeInTheDocument();
    });

    it('shows an error with retry when the calendar list cannot be loaded', async () => {
      mockApi(CONNECTED_WITHOUT_CALENDAR, {
        'GET /staff/calendar/calendars': () => Promise.reject(new ApiError(502, 'CALENDAR_PROVIDER_ERROR', 'boom')),
      });
      renderTab();
      expect(await screen.findByText('Google Calendar no respondió. Probá de nuevo en un rato.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });
  });

  describe('connect', () => {
    it.each([
      ['disconnected', status({}), 'Conectar Google Calendar'],
      ['needs_reconnect', NEEDS_RECONNECT, 'Reconectar'],
    ])('asks the API for the consent URL and sends the browser there (%s)', async (_name, current, label) => {
      mockApi(current, {
        'POST /staff/calendar/connect': () => Promise.resolve({ authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' }),
      });
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: label }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc'));
      expect(callsTo('POST', '/staff/calendar/connect')).toHaveLength(1);
    });

    it('shows the API message and does not navigate when Google is not configured', async () => {
      mockApi(status({}), {
        'POST /staff/calendar/connect': () => Promise.reject(new ApiError(409, 'CALENDAR_NOT_CONFIGURED', 'Calendar is not configured')),
      });
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Conectar Google Calendar' }));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('La conexión con Google Calendar no está configurada.'));
      expect(assign).not.toHaveBeenCalled();
    });
  });

  describe('choose calendar', () => {
    it('saves the chosen calendar and then shows the connected state', async () => {
      let saved = false;
      mockApi(CONNECTED_WITHOUT_CALENDAR, {
        'GET /staff/calendar': () => Promise.resolve(saved ? CONNECTED : CONNECTED_WITHOUT_CALENDAR),
        'PATCH /staff/calendar': () => {
          saved = true;
          return Promise.resolve(CONNECTED);
        },
      });
      renderTab();
      await userEvent.selectOptions(await screen.findByLabelText('Calendario de MOVE'), 'cal-1');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith('/staff/calendar', { method: 'PATCH', body: { calendarId: 'cal-1' } }),
      );
      expect(await screen.findByRole('button', { name: 'Sincronizar ahora' })).toBeInTheDocument();
      expect(toastSuccess).toHaveBeenCalledWith('Calendario guardado.');
    });

    it('shows the API message when the calendar is rejected', async () => {
      mockApi(CONNECTED_WITHOUT_CALENDAR, {
        'PATCH /staff/calendar': () => Promise.reject(new ApiError(400, 'CALENDAR_INVALID_CALENDAR', 'Invalid calendar')),
      });
      renderTab();
      await userEvent.selectOptions(await screen.findByLabelText('Calendario de MOVE'), 'cal-2');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Elegí un calendario de la lista.'));
      expect(screen.queryByText('Invalid calendar')).toBeNull();
    });
  });

  describe('synchronize', () => {
    it('runs the sync, shows the new date and refreshes the slots', async () => {
      mockApi(CONNECTED, {
        'POST /staff/calendar/sync': () => Promise.resolve({ ...CONNECTED, lastPullAt: '2026-10-14T15:30:00.000Z' }),
      });
      renderTab();
      await screen.findByText('14/10/2026 10:05');
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      await userEvent.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
      expect(await screen.findByText('14/10/2026 12:30')).toBeInTheDocument();
      expect(callsTo('POST', '/staff/calendar/sync')).toHaveLength(1);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff', 'time-slots'] });
      expect(toastSuccess).toHaveBeenCalledWith('Sincronizamos con Google Calendar.');
    });

    it('disables the button while the sync is running so it cannot be sent twice', async () => {
      let finish: (value: CalendarStatusDto) => void = () => undefined;
      mockApi(CONNECTED, { 'POST /staff/calendar/sync': () => new Promise((resolve) => { finish = resolve; }) });
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Sincronizar ahora' }));
      expect(await screen.findByRole('button', { name: 'Sincronizando…' })).toBeDisabled();
      finish(CONNECTED);
      expect(await screen.findByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled();
      expect(callsTo('POST', '/staff/calendar/sync')).toHaveLength(1);
    });

    it('shows the API message when Google does not answer', async () => {
      mockApi(CONNECTED, {
        'POST /staff/calendar/sync': () => Promise.reject(new ApiError(502, 'CALENDAR_PROVIDER_ERROR', 'Google Calendar request failed')),
      });
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Sincronizar ahora' }));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Google Calendar no respondió. Probá de nuevo en un rato.'));
      expect(screen.queryByText('Google Calendar request failed')).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('asks for confirmation, explains that created events stay in Google, and does nothing until confirmed', async () => {
      mockApi(CONNECTED);
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Los eventos que ya se crearon en Google Calendar quedan ahí/)).toBeInTheDocument();
      expect(callsTo('DELETE', '/staff/calendar')).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Volver' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(callsTo('DELETE', '/staff/calendar')).toHaveLength(0);
    });

    it('disconnects once confirmed and shows the disconnected state', async () => {
      mockApi(CONNECTED, {
        'DELETE /staff/calendar': () => Promise.resolve(status({})),
      });
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, desconectar' }));
      expect(await screen.findByRole('button', { name: 'Conectar Google Calendar' })).toBeInTheDocument();
      expect(callsTo('DELETE', '/staff/calendar')).toHaveLength(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the dialog open with the API message when disconnecting fails', async () => {
      mockApi(CONNECTED, {
        'DELETE /staff/calendar': () => Promise.reject(new ApiError(502, 'CALENDAR_PROVIDER_ERROR', 'boom')),
      });
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, desconectar' }));
      expect(await within(dialog).findByText('Google Calendar no respondió. Probá de nuevo en un rato.')).toBeInTheDocument();
    });
  });

  describe('result of the Google consent screen (?calendar=)', () => {
    it('toasts a success and clears the parameter keeping the tab', async () => {
      search = 'tab=calendario&calendar=connected';
      mockApi(CONNECTED_WITHOUT_CALENDAR);
      renderTab();
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Google Calendar conectado'));
      expect(replace).toHaveBeenCalledWith('/staff/configuracion?tab=calendario');
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it('toasts an error and clears the parameter', async () => {
      search = 'tab=calendario&calendar=error';
      mockApi(status({}));
      renderTab();
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('No pudimos conectar Google Calendar. Probá de nuevo.'));
      expect(replace).toHaveBeenCalledWith('/staff/configuracion?tab=calendario');
    });

    it.each(['', 'tab=calendario', 'tab=calendario&calendar=hacked', 'tab=calendario&calendar=__proto__'])(
      'ignores %j',
      async (value) => {
        search = value;
        mockApi(status({}));
        renderTab();
        await screen.findByRole('button', { name: 'Conectar Google Calendar' });
        expect(toastSuccess).not.toHaveBeenCalled();
        expect(toastError).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
      },
    );
  });
});
