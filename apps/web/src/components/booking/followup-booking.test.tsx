import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MeDto, PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';
import { businessTodayWeb } from '@/lib/format';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/reservar/fisioterapia' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { FollowupBooking, FollowupCard } = await import('./followup-booking');

const today = businessTodayWeb();
const settings: PublicSettingsDto = { cancelLimitHours: 2, bookingWindowDays: 14 };
const slot: TimeSlotDto = {
  id: 'slot-f1', service: 'rehab', startsAt: `${today}T14:00:00.000Z`, endsAt: `${today}T15:00:00.000Z`, capacity: 1,
  booked: 0, available: 1, isFull: false, professional: { id: 'p1', name: 'Dra. Gómez' }, bookedByMe: false,
};

function makeMe(overrides: Partial<MeDto>): MeDto {
  return { id: 'u1', name: 'Ana', email: 'ana@mail.com', role: 'client', phone: null, rehabFollowupEnabled: true, ...overrides };
}

function mockApi(me: MeDto | ApiError, booking: () => unknown = () => ({ id: 'b1' })) {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/me') {
      if (me instanceof ApiError) throw me;
      return me;
    }
    if (path === '/settings/public') return settings;
    if (path === '/schedule/availability') return [{ date: today, available: 1 }];
    if (path === '/schedule/time-slots') return [slot];
    if (path === '/bookings' && init?.method === 'POST') return booking();
    throw new Error(`unexpected request ${path}`);
  });
}

function renderWithClient(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const view = render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
  /** Espera a que `/me` termine (con datos o con error): antes de eso el componente también renderiza `null`. */
  const meSettled = () => vi.waitFor(() => expect(queryClient.getQueryState(['me'])?.fetchStatus).toBe('idle'));
  return { invalidate, meSettled, ...view };
}

async function pickSlot() {
  await userEvent.click(await screen.findByRole('button', { name: String(Number(today.slice(8))) }));
  await userEvent.click(await screen.findByRole('button', { name: '11:00' }));
}

describe('FollowupCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links enabled clients to the follow-up booking', async () => {
    mockApi(makeMe({}));
    renderWithClient(<FollowupCard />);

    expect(await screen.findByRole('link', { name: /Seguimiento/ })).toHaveAttribute('href', '/reservar/fisioterapia');
  });

  it('renders nothing for visitors', async () => {
    mockApi(new ApiError(401, 'UNAUTHENTICATED', 'x'));
    const { container, meSettled } = renderWithClient(<FollowupCard />);

    await meSettled();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for clients without the follow-up enabled', async () => {
    mockApi(makeMe({ rehabFollowupEnabled: false }));
    const { container, meSettled } = renderWithClient(<FollowupCard />);

    await meSettled();
    expect(apiFetch).toHaveBeenCalledWith('/me');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for staff even when the flag is on', async () => {
    mockApi(makeMe({ role: 'staff', rehabFollowupEnabled: true }));
    const { container, meSettled } = renderWithClient(<FollowupCard />);

    await meSettled();
    expect(apiFetch).toHaveBeenCalledWith('/me');
    expect(screen.queryByRole('link', { name: /Seguimiento/ })).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FollowupBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explains that the follow-up is not enabled yet', async () => {
    mockApi(makeMe({ rehabFollowupEnabled: false }));
    renderWithClient(<FollowupBooking />);

    expect(await screen.findByText('Seguimiento no habilitado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Rehab' })).toHaveAttribute('href', '/rehab');
  });

  it('shows the error state with retry when the profile cannot be loaded', async () => {
    mockApi(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderWithClient(<FollowupBooking />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('books the selected slot and clears the selection once confirmed', async () => {
    mockApi(makeMe({}));
    const { invalidate } = renderWithClient(<FollowupBooking />);

    await pickSlot();
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await vi.waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/bookings', { method: 'POST', body: { timeSlotId: 'slot-f1' } }),
    );
    await vi.waitFor(() => expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['availability'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'bookings'] });
  });

  it('keeps the selection when the booking fails and refreshes bookings and availability', async () => {
    mockApi(
      makeMe({}),
      () => {
        throw new ApiError(409, 'SLOT_FULL', 'El turno está completo.');
      },
    );
    const { invalidate } = renderWithClient(<FollowupBooking />);

    await pickSlot();
    await userEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'bookings'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['availability'] });
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeEnabled();
  });
});
