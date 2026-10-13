import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfessionalDto } from '@/lib/api/types';
import { TemplateForm } from './template-form';

const PROFESSIONALS: ProfessionalDto[] = [{ id: 'pro-1', name: 'Lucía Pereira', active: true }];

function renderTemplateForm(onSubmit = vi.fn()) {
  render(<TemplateForm mode="template" professionals={PROFESSIONALS} onSubmit={onSubmit} />);
  return onSubmit;
}

describe('TemplateForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('submits a performance template with the default capacity', async () => {
    const onSubmit = renderTemplateForm();
    await userEvent.type(screen.getByLabelText('Hora'), '19:00');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      service: 'performance',
      weekday: 1,
      startTime: '19:00',
      durationMinutes: 60,
      capacity: 14,
      professionalId: undefined,
    });
  });

  describe('with the Rehab service', () => {
    it('fixes the capacity at 1 and requires a professional', async () => {
      const onSubmit = renderTemplateForm();
      await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'rehab');
      await userEvent.type(screen.getByLabelText('Hora'), '10:00');
      const capacity = screen.getByLabelText('Cupo (fijo en Fisioterapia)');
      expect(capacity).toHaveValue(1);
      expect(capacity).toHaveAttribute('readonly');

      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText('Elegí un profesional para Fisioterapia.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();

      await userEvent.selectOptions(screen.getByLabelText('Profesional (obligatorio)'), 'pro-1');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenCalledWith({
        service: 'rehab',
        weekday: 1,
        startTime: '10:00',
        durationMinutes: 60,
        capacity: 1,
        professionalId: 'pro-1',
      });
    });

    it('keeps a single capacity input and restores the default when leaving Rehab', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      renderTemplateForm();
      const capacity = screen.getByLabelText('Cupo');
      await userEvent.clear(capacity);
      await userEvent.type(capacity, '10');

      await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'rehab');
      expect(screen.getByLabelText('Cupo (fijo en Fisioterapia)')).toBe(capacity);
      expect(capacity).toHaveValue(1);

      await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'recovery');
      expect(screen.getByLabelText('Cupo')).toBe(capacity);
      expect(capacity).toHaveValue(14);
      expect(capacity).not.toHaveAttribute('readonly');
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps the typed capacity when switching between services other than Rehab', async () => {
      renderTemplateForm();
      const capacity = screen.getByLabelText('Cupo');
      await userEvent.clear(capacity);
      await userEvent.type(capacity, '10');
      await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'recovery');
      expect(capacity).toHaveValue(10);
    });

    it('submits the restored default after Rehab -> Recovery', async () => {
      const onSubmit = renderTemplateForm();
      await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'rehab');
      await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'recovery');
      await userEvent.type(screen.getByLabelText('Hora'), '08:00');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ service: 'recovery', capacity: 14 }));
    });
  });

  it.each(['1e2', '1.5', '2e1'])('rejects %s as a duration', async (value) => {
    const onSubmit = renderTemplateForm();
    await userEvent.type(screen.getByLabelText('Hora'), '19:00');
    const duration = screen.getByLabelText('Duración (min)');
    fireEvent.change(duration, { target: { value } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá un número entero.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the range error and links it to the field for assistive technology', async () => {
    renderTemplateForm();
    await userEvent.type(screen.getByLabelText('Hora'), '19:00');
    const duration = screen.getByLabelText('Duración (min)');
    await userEvent.clear(duration);
    await userEvent.type(duration, '500');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const message = await screen.findByText('Debe estar entre 15 y 240.');
    expect(duration).toHaveAttribute('aria-invalid', 'true');
    expect(duration).toHaveAttribute('aria-describedby', message.id);
    expect(screen.getByLabelText('Cupo')).not.toHaveAttribute('aria-invalid');
  });

  it('validates the date in slot mode', async () => {
    const onSubmit = vi.fn();
    render(<TemplateForm mode="slot" professionals={PROFESSIONALS} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Hora'), '19:00');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá una fecha válida.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
