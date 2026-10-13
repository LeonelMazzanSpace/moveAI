import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

const { NewClientForm } = await import('./new-client-form');
const { newClientSchema } = await import('./new-client.schema');

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewClientForm />
    </QueryClientProvider>,
  );
}

async function fill(email = 'ana@test.move') {
  await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Ana Pérez');
  await userEvent.type(screen.getByLabelText('Email'), email);
}

describe('NewClientForm', () => {
  beforeEach(() => {
    push.mockReset();
    apiFetch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('rejects an invalid email before calling the API', async () => {
    renderForm();
    await fill('no-es-un-email');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('rejects a short name and a phone outside 6–20 characters', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'A');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.move');
    await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    expect(await screen.findByText('Ingresá el nombre (mínimo 2 caracteres).')).toBeInTheDocument();
    expect(screen.getByText('El teléfono debe tener entre 6 y 20 caracteres.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows EMAIL_ALREADY_REGISTERED under the email field', async () => {
    apiFetch.mockRejectedValue(new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'x'));
    renderForm();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    expect(await screen.findByText('Ya existe una cuenta con ese email.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });

  it('creates the client, notifies and opens the detail', async () => {
    apiFetch.mockResolvedValue({ id: 'c1', name: 'Ana Pérez' });
    renderForm();
    await fill();
    await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '099123456');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/staff/clientes/c1'));
    expect(apiFetch).toHaveBeenCalledWith('/staff/clients', {
      method: 'POST',
      body: { name: 'Ana Pérez', email: 'ana@test.move', phone: '099123456' },
    });
    expect(toastSuccess).toHaveBeenCalledWith('Cliente creado. Le enviamos un email para activar su cuenta.');
  });

  it('omits the phone when empty and shows other contract errors', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderForm();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/staff/clients', { method: 'POST', body: { name: 'Ana Pérez', email: 'ana@test.move' } });
  });

  it('sends the name, email and phone trimmed when they are typed with surrounding spaces', async () => {
    apiFetch.mockResolvedValue({ id: 'c1' });
    renderForm();
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: '  Ana Pérez  ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  ana@test.move  ' } });
    fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '  099123456  ' } });
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/staff/clientes/c1'));
    expect(apiFetch).toHaveBeenCalledWith('/staff/clients', {
      method: 'POST',
      body: { name: 'Ana Pérez', email: 'ana@test.move', phone: '099123456' },
    });
  });

  it('rejects values that are too long without calling the API', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'A'.repeat(81) } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: `${'a'.repeat(250)}@test.move` } });
    fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '9'.repeat(21) } });
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    expect(await screen.findByText('El nombre es demasiado largo.')).toBeInTheDocument();
    expect(screen.getByText('El email es demasiado largo.')).toBeInTheDocument();
    expect(screen.getByText('El teléfono debe tener entre 6 y 20 caracteres.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('accepts an email of exactly 254 characters', async () => {
    apiFetch.mockResolvedValue({ id: 'c1' });
    renderForm();
    const email = `${'a'.repeat(244)}@test.move`;
    expect(email).toHaveLength(254);
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/staff/clientes/c1'));
  });
});

describe('newClientSchema', () => {
  it('trims the email and the name before validating', () => {
    const parsed = newClientSchema.parse({ name: '  Ana Pérez  ', email: '  ana@test.move  ', phone: '  099123456  ' });
    expect(parsed).toEqual({ name: 'Ana Pérez', email: 'ana@test.move', phone: '099123456' });
  });

  it('rejects an email that is only spaces', () => {
    expect(newClientSchema.safeParse({ name: 'Ana Pérez', email: '   ', phone: '' }).success).toBe(false);
  });

  it('rejects an email longer than 254 characters even after trimming', () => {
    const result = newClientSchema.safeParse({ name: 'Ana Pérez', email: `  ${'a'.repeat(250)}@test.move  `, phone: '' });
    expect(result.success).toBe(false);
  });
});
