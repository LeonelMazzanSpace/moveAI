import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: push }), useSearchParams: () => new URLSearchParams('next=/rehab') }));
const signUpEmail = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { signUp: { email: signUpEmail } } }));

const { RegisterForm } = await import('./register-form');

async function fillValid(password = 'Secreto123!') {
  await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Ana Pérez');
  await userEvent.type(screen.getByLabelText('Email'), 'ana@test.move');
  await userEvent.type(screen.getByLabelText('Contraseña'), password);
}

describe('RegisterForm', () => {
  beforeEach(() => { push.mockReset(); signUpEmail.mockReset(); });

  it('rejects a short password before submitting', async () => {
    render(<RegisterForm />);
    await fillValid('12345');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('signs up without phone and continues with next', async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: '1' } }, error: null });
    render(<RegisterForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(signUpEmail).toHaveBeenCalledWith({ name: 'Ana Pérez', email: 'ana@test.move', password: 'Secreto123!' });
    expect(push).toHaveBeenCalledWith('/continuar?next=%2Frehab');
  });

  it('sends the phone when provided', async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: '1' } }, error: null });
    render(<RegisterForm />);
    await fillValid();
    await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '099123456');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(signUpEmail).toHaveBeenCalledWith({ name: 'Ana Pérez', email: 'ana@test.move', password: 'Secreto123!', phone: '099123456' });
  });

  it('rejects a phone that is too short', async () => {
    render(<RegisterForm />);
    await fillValid();
    await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('El teléfono debe tener entre 6 y 20 caracteres.')).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('points to sign-in when the email already exists', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { status: 422, code: 'USER_ALREADY_EXISTS', message: 'User already exists' } });
    render(<RegisterForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/Ya existe una cuenta con ese email\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingresá' })).toHaveAttribute('href', '/ingresar?next=%2Frehab');
    expect(push).not.toHaveBeenCalled();
  });
});
