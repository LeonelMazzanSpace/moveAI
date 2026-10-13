import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: push }), useSearchParams: () => new URLSearchParams('next=/performance') }));
const signInEmail = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { email: signInEmail } } }));

const { LoginForm } = await import('./login-form');

describe('LoginForm', () => {
  beforeEach(() => { push.mockReset(); signInEmail.mockReset(); });

  it('validates before submitting', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('signs in and continues with next', async () => {
    signInEmail.mockResolvedValue({ data: { user: { id: '1' } }, error: null });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.move');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreto123!');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(signInEmail).toHaveBeenCalledWith({ email: 'ana@test.move', password: 'Secreto123!' });
    expect(push).toHaveBeenCalledWith('/continuar?next=%2Fperformance');
  });

  it('shows a generic error on bad credentials', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { status: 401, message: 'Invalid email or password' } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.move');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
