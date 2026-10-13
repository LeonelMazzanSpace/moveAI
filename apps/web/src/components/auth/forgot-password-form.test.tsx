import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgotSchema, loginSchema, registerSchema } from './schemas';

const requestPasswordReset = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { requestPasswordReset } }));

const { ForgotPasswordForm } = await import('./forgot-password-form');

const SENT_MESSAGE = 'Si el email está registrado, te enviamos un link para restablecer tu contraseña.';

async function submit(email: string) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => { requestPasswordReset.mockReset(); });

  it('validates the email before calling the API', async () => {
    render(<ForgotPasswordForm />);
    await submit('no-es-un-email');
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('trims the email in every auth schema before validating it', () => {
    expect(forgotSchema.parse({ email: ' ana@x.com ' })).toEqual({ email: 'ana@x.com' });
    expect(loginSchema.parse({ email: ' ana@x.com ', password: 'x' }).email).toBe('ana@x.com');
    expect(registerSchema.parse({ name: 'Ana', email: ' ana@x.com ', password: 'Secreto123!', phone: '' }).email).toBe('ana@x.com');
  });

  it('accepts a pasted email with spaces and sends it trimmed', async () => {
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    render(<ForgotPasswordForm />);
    await submit(' ana@x.com ');
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'ana@x.com', redirectTo: `${window.location.origin}/restablecer` });
    expect(await screen.findByText(SENT_MESSAGE)).toBeInTheDocument();
  });

  it('rejects an email longer than 254 characters', async () => {
    render(<ForgotPasswordForm />);
    await userEvent.click(screen.getByLabelText('Email'));
    await userEvent.paste(`${'a'.repeat(250)}@x.com`);
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows the same message when the request fails, so it never reveals whether the email exists', async () => {
    requestPasswordReset.mockRejectedValue(new Error('network'));
    render(<ForgotPasswordForm />);
    await submit('ana@x.com');
    expect(await screen.findByText(SENT_MESSAGE)).toBeInTheDocument();
  });
});
