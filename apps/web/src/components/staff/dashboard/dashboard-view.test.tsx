import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AlertCountsDto, DashboardDto, StaffTimeSlotDto } from '@/lib/api/types';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { DashboardView } = await import('./dashboard-view');

const COUNTS: AlertCountsDto = {
  expiring: 12, expired: 3, no_attendance: 4, prolonged_inactivity: 1, frequency_drop: 2, recontact: 0, checkin_pain: 1, checkin_goals: 0, total: 23,
};

const slot = (over: Partial<StaffTimeSlotDto>): StaffTimeSlotDto => ({
  id: 's1', service: 'performance', startsAt: '2026-10-13T21:00:00.000Z', endsAt: '2026-10-13T22:00:00.000Z', capacity: 14,
  professional: null, cancelledAt: null, calendarBlocked: false, calendarConflict: false, booked: 12, present: 8, absent: 1, noShow: 1, cancelled: 1, pendingAttendance: 2, ...over,
});

const DASHBOARD: DashboardDto = {
  kpis: { active: 182, activeDeltaMonth: 6, expiringSoon: 12, inactive: 5, attendancesToday: 64, slotsToday: 8 },
  alertCounts: COUNTS,
  todaySlots: [slot({}), slot({ id: 's2', service: 'recovery', startsAt: '2026-10-13T13:00:00.000Z', capacity: 6, booked: 2, present: 0 })],
  pendingAttendanceSlots: 2,
};

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardView />
    </QueryClientProvider>,
  );
}

describe('DashboardView', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('shows the KPIs, alert cards, today slots and the pending attendance banner', async () => {
    apiFetch.mockResolvedValue(DASHBOARD);
    renderView();
    expect(await screen.findByRole('group', { name: 'Clientes activos' })).toHaveTextContent('182');
    expect(screen.getByRole('group', { name: 'Clientes activos' })).toHaveTextContent('+6 este mes');
    expect(screen.getByRole('group', { name: 'Planes por vencer' })).toHaveTextContent('12');
    expect(screen.getByRole('group', { name: 'Inactivos' })).toHaveTextContent('5');
    expect(screen.getByRole('group', { name: 'Asistencias hoy' })).toHaveTextContent('en 8 turnos');
    expect(apiFetch).toHaveBeenCalledWith('/staff/dashboard');

    expect(screen.getByRole('link', { name: 'Por vencer · 12' })).toHaveAttribute('href', '/staff/seguimiento?tipo=expiring');
    expect(screen.getByRole('link', { name: 'Check-in con dolor · 1' })).toHaveAttribute('href', '/staff/seguimiento?tipo=checkin_pain');
    expect(screen.getByText('Hay 2 turnos con asistencia pendiente')).toBeInTheDocument();
  });

  it('links each of today\'s slots to the attendance screen', async () => {
    apiFetch.mockResolvedValue(DASHBOARD);
    renderView();
    const row = await screen.findByRole('row', { name: /18:00/ });
    expect(within(row).getByText('Performance')).toBeInTheDocument();
    expect(within(row).getByText('12/14')).toBeInTheDocument();
    expect(within(row).getByText('8')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Ver turno' })).toHaveAttribute(
      'href',
      '/staff/turnos?fecha=2026-10-13&servicio=performance&turno=s1',
    );
    expect(screen.getByRole('row', { name: /10:00/ })).toHaveTextContent('Recovery');
  });

  it('hides the banner without pending slots and explains an empty day', async () => {
    apiFetch.mockResolvedValue({ ...DASHBOARD, todaySlots: [], pendingAttendanceSlots: 0 });
    renderView();
    expect(await screen.findByText('Sin turnos hoy')).toBeInTheDocument();
    expect(screen.queryByText(/asistencia pendiente/)).not.toBeInTheDocument();
  });

  it('uses the singular for one pending slot', async () => {
    apiFetch.mockResolvedValue({ ...DASHBOARD, pendingAttendanceSlots: 1 });
    renderView();
    expect(await screen.findByText('Hay 1 turno con asistencia pendiente')).toBeInTheDocument();
  });

  it('shows the contract message when the dashboard fails', async () => {
    apiFetch.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'x'));
    renderView();
    expect(await screen.findByText('No tenés permiso para esta acción.')).toBeInTheDocument();
  });
});
