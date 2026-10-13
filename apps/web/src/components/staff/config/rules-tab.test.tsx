import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsDto } from '@/lib/api/types';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { RulesTab } = await import('./rules-tab');

const DEFAULTS: SettingsDto = {
  cancelLimitHours: 2,
  bookingWindowDays: 14,
  pendingPaymentMinutes: 15,
  reconcileAfterMinutes: 10,
  expiringSoonDays: 7,
  noAttendanceDays: 7,
  prolongedInactivityDays: 21,
  frequencyDropRatio: 0.5,
  frequencyRecentWeeks: 2,
  frequencyBaselineWeeks: 8,
  checkinMonthlyEnabled: true,
  valuesProvisional: true,
};

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RulesTab />
    </QueryClientProvider>,
  );
}

function patchCalls() {
  return apiFetch.mock.calls.filter(([, init]) => init?.method === 'PATCH');
}

describe('RulesTab', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string; body?: Partial<SettingsDto> }) =>
      init?.method === 'PATCH' ? { ...DEFAULTS, ...init.body } : DEFAULTS,
    );
  });

  it('warns that the values are provisional', async () => {
    renderTab();
    expect(await screen.findByText('Valores provisorios — confirmar con MOVE')).toBeInTheDocument();
  });

  it('blocks a prolonged inactivity value that is not above the days without attendance', async () => {
    renderTab();
    const field = await screen.findByLabelText('Días de inactividad prolongada');
    await userEvent.clear(field);
    await userEvent.type(field, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Debe ser mayor que los días sin asistir.')).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('sends only the modified fields', async () => {
    renderTab();
    const field = await screen.findByLabelText('Horas para cancelar');
    await userEvent.clear(field);
    await userEvent.type(field, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith('/staff/settings', { method: 'PATCH', body: { cancelLimitHours: 3 } });
  });

  it('marks the values as confirmed when the checkbox is ticked', async () => {
    renderTab();
    await userEvent.click(await screen.findByLabelText('Marcar los valores como confirmados'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith('/staff/settings', { method: 'PATCH', body: { valuesProvisional: false } });
  });
});
