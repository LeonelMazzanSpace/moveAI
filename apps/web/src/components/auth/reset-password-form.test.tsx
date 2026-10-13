import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let search = 'token=abc123';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }));
const resetPassword = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { resetPassword } }));

const { ResetPasswordForm } = await import('./reset-password-form');

async function fill(password: string, confirm: string) {
  await userEvent.type(screen.getByLabelText('Nueva contraseña'), password);
  await userEvent.type(screen.getByLabelText('Repetí la contraseña'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
}

describe('ResetPasswordForm', () => {
  beforeEach(() => { search = 'token=abc123'; resetPassword.mockReset(); });

  it('links to password recovery when there is no token', () => {
    search = '';
    render(<ResetPasswordForm />);
    expect(screen.getByRole('link', { name: 'Pedir un link nuevo' })).toHaveAttribute('href', '/recuperar');
  });

  it('requires both passwords to match', async () => {
    render(<ResetPasswordForm />);
    await fill('Secreto123!', 'Otra12345!');
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('resets the password and links to sign-in', async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    render(<ResetPasswordForm />);
    await fill('Secreto123!', 'Secreto123!');
    expect(resetPassword).toHaveBeenCalledWith({ newPassword: 'Secreto123!', token: 'abc123' });
    expect(await screen.findByText('Listo, ya podés ingresar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute('href', '/ingresar');
  });

  it('asks for a new link when the token is invalid', async () => {
    resetPassword.mockResolvedValue({ data: null, error: { status: 400, message: 'Invalid token' } });
    render(<ResetPasswordForm />);
    await fill('Secreto123!', 'Secreto123!');
    expect(await screen.findByText('El link venció o ya fue usado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir un link nuevo' })).toHaveAttribute('href', '/recuperar');
  });
});
