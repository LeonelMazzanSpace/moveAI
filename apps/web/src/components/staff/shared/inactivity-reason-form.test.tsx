import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { InactivityReasonForm, type InactivityReasonValues } from './inactivity-reason-form';

const onSubmit = vi.fn<(values: InactivityReasonValues) => Promise<unknown>>();

function renderForm() {
  return render(<InactivityReasonForm onSubmit={onSubmit} />);
}

describe('InactivityReasonForm', () => {
  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-13T15:00:00.000Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('asks for a reason before submitting', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('Elegí un motivo.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the reason error once a reason is picked', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await screen.findByText('Elegí un motivo.');
    await userEvent.click(screen.getByRole('button', { name: 'Mudanza' }));
    await waitFor(() => expect(screen.queryByText('Elegí un motivo.')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Mudanza' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('rejects a re-contact date before today and accepts today', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    fireEvent.change(screen.getByLabelText('Fecha de re-contacto'), { target: { value: '2026-10-12' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('La fecha de re-contacto no puede ser anterior a hoy.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Fecha de re-contacto'), { target: { value: '2026-10-13' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: 'injury', recontactOn: '2026-10-13' }));
  });

  it('rejects a note over 1000 characters and sends a trimmed one', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Vacaciones' }));
    fireEvent.change(screen.getByLabelText('Nota interna (opcional)'), { target: { value: ' '.repeat(5) + 'x'.repeat(1001) } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('La nota es demasiado larga (máximo 1000 caracteres).')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nota interna (opcional)'), { target: { value: '  Viaja a Brasil  ' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: 'vacation', note: 'Viaja a Brasil' }));
  });

  it('treats a note with only spaces as no note', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Vacaciones' }));
    fireEvent.change(screen.getByLabelText('Nota interna (opcional)'), { target: { value: '     ' } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: 'vacation' }));
  });

  it('places API field errors in their fields', async () => {
    onSubmit.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'x', [
        { field: 'reason', messages: ['Motivo inválido.'] },
        { field: 'note', messages: ['Nota inválida.'] },
        { field: 'recontactOn', messages: ['Fecha inválida.'] },
      ]),
    );
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByText('Motivo inválido.')).toBeInTheDocument();
    expect(screen.getByText('Nota inválida.')).toBeInTheDocument();
    expect(screen.getByText('Fecha inválida.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nota interna (opcional)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Fecha de re-contacto')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows errors that are not tied to a field as an alert', async () => {
    onSubmit.mockRejectedValue(new ApiError(409, 'PAUSE_ALREADY_ACTIVE', 'x'));
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente ya tiene una pausa activa.');
  });

  it('ignores field errors for fields the form does not have', async () => {
    onSubmit.mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'secret', messages: ['no mostrar'] }]));
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar motivo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Los datos enviados no son válidos.');
    expect(screen.queryByText('no mostrar')).not.toBeInTheDocument();
  });

  it('disables the submit button while the request is pending', async () => {
    let release: () => void = () => undefined;
    onSubmit.mockImplementation(() => new Promise((resolve) => { release = () => resolve(undefined); }));
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lesión' }));
    const submit = screen.getByRole('button', { name: 'Registrar motivo' });
    await userEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await userEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(submit).toBeEnabled());
  });
});
