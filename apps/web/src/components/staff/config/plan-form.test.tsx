import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanForm } from './plan-form';

describe('PlanForm', () => {
  it('shows the fields of the selected kind and nulls the rest', async () => {
    const onSubmit = vi.fn();
    render(<PlanForm mode="create" onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'recovery');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'session_pack');
    expect(screen.queryByLabelText('Meses')).toBeNull();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Paquete 6 sesiones');
    await userEvent.type(screen.getByLabelText('Identificador'), 'recovery-paquete-6');
    await userEvent.type(screen.getByLabelText('Precio (UYU)'), '4500');
    await userEvent.type(screen.getByLabelText('Días de vigencia'), '30');
    await userEvent.type(screen.getByLabelText('Sesiones incluidas'), '6');
    await userEvent.type(screen.getByLabelText('Duración (min)'), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      service: 'recovery', kind: 'session_pack', price: 4500, periodDays: 30, sessionsIncluded: 6, durationMinutes: 45, periodMonths: null,
    }));
  });

  it('rejects an invalid slug', async () => {
    render(<PlanForm mode="create" onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Identificador'), 'Plan Anual');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Usá minúsculas, números y guiones.')).toBeInTheDocument();
  });
});
