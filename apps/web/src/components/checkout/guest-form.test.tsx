import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuestForm } from './guest-form';

async function fill(values: { name: string; email: string; phone: string }) {
  await userEvent.type(screen.getByLabelText('Nombre'), values.name);
  await userEvent.type(screen.getByLabelText('Email'), values.email);
  await userEvent.type(screen.getByLabelText('Teléfono'), values.phone);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('GuestForm', () => {
  it('rejects an invalid email', async () => {
    const onSubmit = vi.fn();
    render(<GuestForm onSubmit={onSubmit} />);
    await fill({ name: 'Ana Pérez', email: 'ana', phone: '099123456' });
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a short phone', async () => {
    const onSubmit = vi.fn();
    render(<GuestForm onSubmit={onSubmit} />);
    await fill({ name: 'Ana Pérez', email: 'ana@mail.com', phone: '099' });
    expect(await screen.findByText('Ingresá un teléfono válido.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid data', async () => {
    const onSubmit = vi.fn();
    render(<GuestForm onSubmit={onSubmit} />);
    await fill({ name: 'Ana Pérez', email: 'ana@mail.com', phone: '099123456' });
    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Ana Pérez', email: 'ana@mail.com', phone: '099123456' }),
    );
  });
});
