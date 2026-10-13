import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
const signOut = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const { LogoutButton } = await import('./logout-button');

describe('LogoutButton', () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signOut.mockReset();
    toastError.mockReset();
  });

  it('goes home and then refreshes the router so headers drop the session', async () => {
    signOut.mockResolvedValue({ data: { success: true }, error: null });
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith('/');
    expect(replace.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0] ?? 0);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows a toast and stays on the page when sign-out fails', async () => {
    signOut.mockResolvedValue({ data: null, error: { status: 500 } });
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('No pudimos cerrar tu sesión. Probá de nuevo.'));
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeEnabled();
  });
});
