import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MeDto } from '@/lib/api/types';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams(search) }));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { default: ContinuarPage } = await import('./page');

const me = (role: MeDto['role']): MeDto => ({ id: '1', name: 'A', email: 'a@x', role, phone: null, rehabFollowupEnabled: false });

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContinuarPage />
    </QueryClientProvider>,
  );
}

describe('/continuar', () => {
  beforeEach(() => {
    replace.mockReset();
    apiFetch.mockReset();
    search = '';
  });

  it('sends a client to the requested page when it is allowed for the role', async () => {
    search = 'next=%2Fcheckout%2Fplan%2Ftrimestral';
    apiFetch.mockResolvedValue(me('client'));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Un momento, te estamos llevando a tu cuenta…');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/checkout/plan/trimestral'));
    expect(apiFetch).toHaveBeenCalledWith('/me');
  });

  it('sends each role to its home when next belongs to the other role or escapes through dot-segments', async () => {
    search = 'next=%2Fperfil%2F..%2Fstaff';
    apiFetch.mockResolvedValue(me('client'));
    const { unmount } = renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/perfil'));
    unmount();

    search = 'next=%2Fperfil';
    apiFetch.mockResolvedValue(me('staff'));
    renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff'));
  });

  it('offers to sign in again, keeping next, when there is no session', async () => {
    search = 'next=%2Fhistorial';
    apiFetch.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Sin sesión'));
    renderPage();
    expect(await screen.findByText('Tu sesión no está activa.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar?next=%2Fhistorial');
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the error with a retry for any other failure', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'boom')).mockResolvedValueOnce(me('staff'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff'));
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
