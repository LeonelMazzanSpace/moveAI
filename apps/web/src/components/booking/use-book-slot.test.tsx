import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const apiFetch = vi.fn();
const push = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/performance' }));
vi.mock('sonner', () => ({ toast }));

const { useBookSlot } = await import('./use-book-slot');

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, ...renderHook(() => useBookSlot(), { wrapper }) };
}

describe('useBookSlot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirms the booking and refreshes slots and bookings', async () => {
    apiFetch.mockResolvedValue({ id: 'b1' });
    const { result, invalidate } = setup();

    act(() => result.current.book('slot-1'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Reserva confirmada'));
    expect(apiFetch).toHaveBeenCalledWith('/bookings', { method: 'POST', body: { timeSlotId: 'slot-1' } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['time-slots'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'bookings'] });
    expect(result.current.planRequired).toBe(false);
  });

  it('flags planRequired without a toast when the plan is not valid', async () => {
    apiFetch.mockRejectedValue(new ApiError(403, 'PLAN_REQUIRED', 'Necesitás un plan vigente para reservar.'));
    const { result } = setup();

    act(() => result.current.book('slot-1'));

    await waitFor(() => expect(result.current.planRequired).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('sends anonymous visitors to the login keeping the current route', async () => {
    apiFetch.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión.'));
    const { result } = setup();

    act(() => result.current.book('slot-1'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/ingresar?next=%2Fperformance'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the error message for any other failure', async () => {
    apiFetch.mockRejectedValue(new ApiError(409, 'SLOT_FULL', 'El turno está completo.'));
    const { result } = setup();

    act(() => result.current.book('slot-1'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('El turno está completo.'));
    expect(result.current.planRequired).toBe(false);
  });
});
