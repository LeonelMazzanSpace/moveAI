import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let search = 'next=/performance';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: push }), useSearchParams: () => new URLSearchParams(search) }));
const signInEmail = vi.fn();
const signInSocial = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { email: signInEmail, social: signInSocial } } }));
vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENABLED', 'true');

const { LoginForm } = await import('./login-form');

describe('LoginForm', () => {
  beforeEach(() => { push.mockReset(); signInEmail.mockReset(); signInSocial.mockReset(); search = 'next=/performance'; });

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

  it('explains that the email already has an account when Google cannot link it', () => {
    search = 'next=/performance&error=account_not_linked';
    render(<LoginForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ya tenés una cuenta con ese email. Ingresá con tu contraseña.');
  });

  it('shows a generic message for any other sign-in error in the URL', () => {
    search = 'error=something_else';
    render(<LoginForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos ingresar con Google. Probá de nuevo.');
  });

  it('shows no alert without an error in the URL', () => {
    render(<LoginForm />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends Google errors back to the login page keeping next', async () => {
    signInSocial.mockResolvedValue({ data: null, error: null });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: `${window.location.origin}/continuar?next=%2Fperformance`,
      errorCallbackURL: `${window.location.origin}/ingresar?next=%2Fperformance`,
    });
  });
});
