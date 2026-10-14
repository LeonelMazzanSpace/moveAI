import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PlanDto } from '@/lib/api/types';
import { PlanForm } from './plan-form';

describe('PlanForm', () => {
  it('shows the fields of the selected kind and omits the rest', async () => {
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
      service: 'recovery', kind: 'session_pack', price: 4500, periodDays: 30, sessionsIncluded: 6, durationMinutes: 45,
    }));
    expect(Object.keys(onSubmit.mock.calls[0][0])).not.toContain('periodMonths');
  });

  it('rejects an invalid slug', async () => {
    render(<PlanForm mode="create" onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Identificador'), 'Plan Anual');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Usá minúsculas, números y guiones.')).toBeInTheDocument();
  });

  it.each([
    ['performance', 'period_plan', true],
    ['recovery', 'session_pack', true],
    ['recovery', 'single_session', false],
    ['rehab', 'evaluation', false],
  ] as const)('shows "Permite débito automático" for %s / %s: %s', async (service, kind, shown) => {
    render(<PlanForm mode="create" onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), service);
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), kind);

    const checkbox = screen.queryByLabelText('Permite débito automático');
    expect(checkbox !== null).toBe(shown);
    if (checkbox) expect(checkbox).not.toBeChecked();
  });

  it('sends the checkbox of an eligible plan in the payload and defaults it to false', async () => {
    const onSubmit = vi.fn();
    render(<PlanForm mode="create" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Nombre'), 'Plan Mensual');
    await userEvent.type(screen.getByLabelText('Identificador'), 'performance-mensual');
    await userEvent.type(screen.getByLabelText('Precio (UYU)'), '3900');
    await userEvent.type(screen.getByLabelText('Meses'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ autoDebitEnabled: false }));

    await userEvent.click(screen.getByLabelText('Permite débito automático'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ autoDebitEnabled: true }));
  });

  it('never sends autoDebitEnabled: true for a kind that cannot have it, even if it was ticked before changing the kind', async () => {
    const onSubmit = vi.fn();
    render(<PlanForm mode="create" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByLabelText('Permite débito automático'));
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'rehab');
    await userEvent.type(screen.getByLabelText('Nombre'), 'Evaluación');
    await userEvent.type(screen.getByLabelText('Identificador'), 'rehab-evaluacion');
    await userEvent.type(screen.getByLabelText('Precio (UYU)'), '1800');
    await userEvent.type(screen.getByLabelText('Duración (min)'), '60');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'evaluation', autoDebitEnabled: false }));
  });

  it('loads the current value when editing an eligible plan', () => {
    const plan: PlanDto = {
      id: 'p1', service: 'performance', kind: 'period_plan', slug: 'performance-mensual', name: 'Plan Mensual', description: '', features: [],
      price: 3900, currency: 'UYU', periodMonths: 1, periodDays: null, sessionsIncluded: null, durationMinutes: null, featured: false,
      active: true, sortOrder: 1, autoDebitEnabled: true,
    };
    render(<PlanForm mode="edit" plan={plan} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Permite débito automático')).toBeChecked();
  });
});