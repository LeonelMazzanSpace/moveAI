import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { PlanDto } from '@/lib/api/types';
import { planFormSchema, planToFormValues } from './plan-form.schema';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { PlansTab } = await import('./plans-tab');

const EXISTING_PLAN: PlanDto = {
  id: 'plan-1',
  service: 'performance',
  kind: 'period_plan',
  slug: 'performance-mensual',
  name: 'Performance mensual',
  description: 'Entrená todo el mes.',
  features: ['Clases ilimitadas'],
  price: 3900,
  currency: 'UYU',
  periodMonths: 1,
  periodDays: null,
  sessionsIncluded: null,
  durationMinutes: null,
  featured: false,
  active: true,
  sortOrder: 1,
};

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlansTab />
    </QueryClientProvider>,
  );
}

function writeCalls(method: 'POST' | 'PATCH') {
  return apiFetch.mock.calls.filter(([, init]) => init?.method === method);
}

function hasNullValue(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.some(hasNullValue);
  if (typeof value === 'object') return Object.values(value as object).some(hasNullValue);
  return false;
}

async function openNewPlanDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'Nuevo plan' }));
  return within(await screen.findByRole('dialog'));
}

async function fillCommonFields(dialog: ReturnType<typeof within>, name: string, slug: string, price: string) {
  await userEvent.type(dialog.getByLabelText('Nombre'), name);
  await userEvent.type(dialog.getByLabelText('Identificador'), slug);
  await userEvent.type(dialog.getByLabelText('Precio (UYU)'), price);
}

describe('PlansTab', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (init?.method === 'POST') return { ...EXISTING_PLAN, ...init.body };
      if (init?.method === 'PATCH') return { ...EXISTING_PLAN, ...init.body };
      return [EXISTING_PLAN];
    });
  });

  it('creates a period plan without the hidden numeric fields', async () => {
    renderTab();
    const dialog = await openNewPlanDialog();
    await fillCommonFields(dialog, 'Performance anual', 'performance-anual', '30000');
    await userEvent.type(dialog.getByLabelText('Meses'), '12');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(writeCalls('POST')).toHaveLength(1));
    const [path, init] = writeCalls('POST')[0];
    expect(path).toBe('/staff/plans');
    expect(init.body).toEqual({
      service: 'performance',
      kind: 'period_plan',
      slug: 'performance-anual',
      name: 'Performance anual',
      description: '',
      features: [],
      price: 30000,
      periodMonths: 12,
      featured: false,
      active: true,
      sortOrder: 0,
    });
    expect(hasNullValue(init.body)).toBe(false);
    expect(Object.keys(init.body)).not.toContain('periodDays');
  });

  it('creates a rehab evaluation sending only its duration', async () => {
    renderTab();
    const dialog = await openNewPlanDialog();
    await userEvent.selectOptions(dialog.getByLabelText('Servicio'), 'rehab');
    await fillCommonFields(dialog, 'Evaluación inicial', 'rehab-evaluacion', '2500');
    await userEvent.type(dialog.getByLabelText('Duración (min)'), '60');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(writeCalls('POST')).toHaveLength(1));
    const { body } = writeCalls('POST')[0][1];
    expect(body).toEqual({
      service: 'rehab',
      kind: 'evaluation',
      slug: 'rehab-evaluacion',
      name: 'Evaluación inicial',
      description: '',
      features: [],
      price: 2500,
      durationMinutes: 60,
      featured: false,
      active: true,
      sortOrder: 0,
    });
    expect(hasNullValue(body)).toBe(false);
  });

  it('creates a recovery pack omitting the empty optional duration', async () => {
    renderTab();
    const dialog = await openNewPlanDialog();
    await userEvent.selectOptions(dialog.getByLabelText('Servicio'), 'recovery');
    await userEvent.selectOptions(dialog.getByLabelText('Tipo'), 'session_pack');
    await fillCommonFields(dialog, 'Paquete 6 sesiones', 'recovery-paquete-6', '4500');
    await userEvent.type(dialog.getByLabelText('Días de vigencia'), '30');
    await userEvent.type(dialog.getByLabelText('Sesiones incluidas'), '6');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(writeCalls('POST')).toHaveLength(1));
    const { body } = writeCalls('POST')[0][1];
    expect(body).toEqual({
      service: 'recovery',
      kind: 'session_pack',
      slug: 'recovery-paquete-6',
      name: 'Paquete 6 sesiones',
      description: '',
      features: [],
      price: 4500,
      periodDays: 30,
      sessionsIncluded: 6,
      featured: false,
      active: true,
      sortOrder: 0,
    });
    expect(hasNullValue(body)).toBe(false);
  });

  it('creates a recovery single session sending only its duration', async () => {
    renderTab();
    const dialog = await openNewPlanDialog();
    await userEvent.selectOptions(dialog.getByLabelText('Servicio'), 'recovery');
    await userEvent.selectOptions(dialog.getByLabelText('Tipo'), 'single_session');
    await fillCommonFields(dialog, 'Sesión individual', 'recovery-sesion', '900');
    await userEvent.type(dialog.getByLabelText('Duración (min)'), '45');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(writeCalls('POST')).toHaveLength(1));
    const { body } = writeCalls('POST')[0][1];
    expect(body).toEqual({
      service: 'recovery',
      kind: 'single_session',
      slug: 'recovery-sesion',
      name: 'Sesión individual',
      description: '',
      features: [],
      price: 900,
      durationMinutes: 45,
      featured: false,
      active: true,
      sortOrder: 0,
    });
    expect(hasNullValue(body)).toBe(false);
  });

  it('edits the price of an existing plan without sending null keys', async () => {
    renderTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = within(await screen.findByRole('dialog'));
    const price = dialog.getByLabelText('Precio (UYU)');
    await userEvent.clear(price);
    await userEvent.type(price, '4200');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(writeCalls('PATCH')).toHaveLength(1));
    const [path, init] = writeCalls('PATCH')[0];
    expect(path).toBe('/staff/plans/plan-1');
    expect(init.body).toEqual({
      slug: 'performance-mensual',
      name: 'Performance mensual',
      description: 'Entrená todo el mes.',
      features: ['Clases ilimitadas'],
      price: 4200,
      periodMonths: 1,
      featured: false,
      active: true,
      sortOrder: 1,
    });
    expect(hasNullValue(init.body)).toBe(false);
  });

  describe('editing a session pack', () => {
    const PACK: PlanDto = {
      ...EXISTING_PLAN,
      id: 'plan-pack',
      service: 'recovery',
      kind: 'session_pack',
      slug: 'recovery-paquete-6',
      name: 'Paquete 6 sesiones',
      price: 4500,
      periodMonths: null,
      periodDays: 30,
      sessionsIncluded: 6,
      durationMinutes: null,
    };

    async function editPack(pack: PlanDto) {
      apiFetch.mockImplementation(async (_path: string, init?: { method?: string; body?: Record<string, unknown> }) =>
        init?.method === 'PATCH' ? { ...pack, ...init.body } : [pack],
      );
      renderTab();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
      return within(await screen.findByRole('dialog'));
    }

    it('omits the duration from the PATCH when the pack has none', async () => {
      const dialog = await editPack(PACK);
      expect(dialog.getByLabelText('Duración (min)')).toHaveValue(null);
      const price = dialog.getByLabelText('Precio (UYU)');
      await userEvent.clear(price);
      await userEvent.type(price, '4800');
      await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

      await vi.waitFor(() => expect(writeCalls('PATCH')).toHaveLength(1));
      const [path, init] = writeCalls('PATCH')[0];
      expect(path).toBe('/staff/plans/plan-pack');
      expect(init.body).toEqual({
        slug: 'recovery-paquete-6',
        name: 'Paquete 6 sesiones',
        description: 'Entrená todo el mes.',
        features: ['Clases ilimitadas'],
        price: 4800,
        periodDays: 30,
        sessionsIncluded: 6,
        featured: false,
        active: true,
        sortOrder: 1,
      });
      expect(Object.keys(init.body)).not.toContain('durationMinutes');
      expect(Object.keys(init.body)).not.toContain('service');
      expect(Object.keys(init.body)).not.toContain('kind');
      expect(hasNullValue(init.body)).toBe(false);
    });

    it('sends the duration in the PATCH when the pack has one', async () => {
      const dialog = await editPack({ ...PACK, durationMinutes: 45 });
      expect(dialog.getByLabelText('Duración (min)')).toHaveValue(45);
      await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

      await vi.waitFor(() => expect(writeCalls('PATCH')).toHaveLength(1));
      expect(writeCalls('PATCH')[0][1].body).toEqual(expect.objectContaining({ periodDays: 30, sessionsIncluded: 6, durationMinutes: 45 }));
      expect(hasNullValue(writeCalls('PATCH')[0][1].body)).toBe(false);
    });

    it('sends a duration typed into a pack that had none', async () => {
      const dialog = await editPack(PACK);
      await userEvent.type(dialog.getByLabelText('Duración (min)'), '50');
      await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

      await vi.waitFor(() => expect(writeCalls('PATCH')).toHaveLength(1));
      expect(writeCalls('PATCH')[0][1].body).toEqual(expect.objectContaining({ durationMinutes: 50 }));
    });
  });

  it('names the rehab service "Fisioterapia" in the tables and the form', async () => {
    renderTab();
    expect(await screen.findByRole('heading', { name: 'Fisioterapia' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay planes de Fisioterapia.')).toBeInTheDocument();
    const dialog = await openNewPlanDialog();
    expect(dialog.getByRole('option', { name: 'Fisioterapia' })).toBeInTheDocument();
    expect(dialog.queryByRole('option', { name: 'Rehab' })).toBeNull();
  });

  it.each([
    ['1e2', 'Ingresá un número entero.'],
    ['12.5', 'Ingresá un número entero.'],
    ['10000001', 'Debe estar entre 0 y 10000000.'],
  ])('rejects the price %s with no request', async (value, message) => {
    renderTab();
    const dialog = await openNewPlanDialog();
    await userEvent.type(dialog.getByLabelText('Nombre'), 'Performance anual');
    await userEvent.type(dialog.getByLabelText('Identificador'), 'performance-anual');
    await userEvent.type(dialog.getByLabelText('Meses'), '12');
    fireEvent.change(dialog.getByLabelText('Precio (UYU)'), { target: { value } });
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await dialog.findByText(message)).toBeInTheDocument();
    expect(writeCalls('POST')).toHaveLength(0);
  });

  it('links field errors to their inputs with aria attributes', async () => {
    renderTab();
    const dialog = await openNewPlanDialog();
    await userEvent.type(dialog.getByLabelText('Identificador'), 'Plan Anual');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    const slug = dialog.getByLabelText('Identificador');
    const message = await dialog.findByText('Usá minúsculas, números y guiones.');
    expect(slug).toHaveAttribute('aria-invalid', 'true');
    expect(slug).toHaveAttribute('aria-describedby', message.id);
    expect(dialog.getByLabelText('Descripción')).not.toHaveAttribute('aria-invalid');
  });

  it('shows the field errors of an API validation failure inline', async () => {
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Los datos enviados no son válidos.', [
          { field: 'slug', messages: ['El identificador ya está en uso por otro plan'] },
          { field: 'description', messages: ['description must be shorter than or equal to 400 characters'] },
        ]);
      }
      return [EXISTING_PLAN];
    });
    renderTab();
    const dialog = await openNewPlanDialog();
    await fillCommonFields(dialog, 'Performance anual', 'performance-anual', '30000');
    await userEvent.type(dialog.getByLabelText('Meses'), '12');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByText('El identificador ya está en uso por otro plan')).toBeInTheDocument();
    expect(dialog.getByText('description must be shorter than or equal to 400 characters')).toBeInTheDocument();
    expect(dialog.getByLabelText('Identificador')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('reports an API error and keeps the dialog open', async () => {
    const { toast } = await import('sonner');
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') throw new Error('boom');
      return [EXISTING_PLAN];
    });
    renderTab();
    const dialog = await openNewPlanDialog();
    await fillCommonFields(dialog, 'Performance anual', 'performance-anual', '30000');
    await userEvent.type(dialog.getByLabelText('Meses'), '12');
    await userEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('planFormSchema integers', () => {
  const base = { ...planToFormValues(EXISTING_PLAN), name: 'Plan', slug: 'plan' };

  it.each(['1e3', '0x10', '1_000', ' ', '-1', '+5', '1.0'])('rejects %j as a price', (price) => {
    expect(planFormSchema.safeParse({ ...base, price }).success).toBe(false);
  });

  it.each([
    ['0', 0],
    ['3900', 3900],
    [' 3900 ', 3900],
    ['007', 7],
    ['10000000', 10_000_000],
  ])('accepts %j as a price', (price, expected) => {
    const result = planFormSchema.safeParse({ ...base, price });
    expect(result.success && result.data.price).toBe(expected);
  });
});
