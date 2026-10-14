import { z } from 'zod';
import { INTEGER_PATTERN, MAX_MONEY_AMOUNT } from '@/components/staff/form-primitives';
import type { PlanDto, PlanKind, Service } from '@/lib/api/types';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SERVICES: Service[] = ['performance', 'rehab', 'recovery'];

export const KINDS_BY_SERVICE: Record<Service, PlanKind[]> = {
  performance: ['period_plan'],
  rehab: ['evaluation'],
  recovery: ['session_pack', 'single_session'],
};

export const KIND_LABEL: Record<PlanKind, string> = {
  period_plan: 'Plan por período',
  session_pack: 'Paquete de sesiones',
  single_session: 'Sesión individual',
  evaluation: 'Evaluación',
};

/** Solo los planes por período y los paquetes pueden cobrarse con débito automático. */
export const AUTO_DEBIT_KINDS: PlanKind[] = ['period_plan', 'session_pack'];

type NumericPlanField = 'periodMonths' | 'periodDays' | 'sessionsIncluded' | 'durationMinutes';
type FieldUsage = 'required' | 'optional' | 'hidden';

export const KIND_FIELDS: Record<PlanKind, Record<NumericPlanField, FieldUsage>> = {
  period_plan: { periodMonths: 'required', periodDays: 'hidden', sessionsIncluded: 'hidden', durationMinutes: 'hidden' },
  session_pack: { periodMonths: 'hidden', periodDays: 'required', sessionsIncluded: 'required', durationMinutes: 'optional' },
  single_session: { periodMonths: 'hidden', periodDays: 'hidden', sessionsIncluded: 'hidden', durationMinutes: 'required' },
  evaluation: { periodMonths: 'hidden', periodDays: 'hidden', sessionsIncluded: 'hidden', durationMinutes: 'required' },
};

const NUMERIC_RANGES: Record<NumericPlanField | 'price' | 'sortOrder', [number, number]> = {
  price: [0, MAX_MONEY_AMOUNT],
  periodMonths: [1, 36],
  periodDays: [1, 365],
  sessionsIncluded: [1, 100],
  durationMinutes: [15, 240],
  sortOrder: [0, 999],
};

const MAX_FEATURES = 10;
const MAX_FEATURE_LENGTH = 120;

export function parseFeatures(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readInteger(
  raw: string,
  field: keyof typeof NUMERIC_RANGES,
  required: boolean,
  addIssue: (message: string) => void,
): number | null {
  const text = raw.trim();
  if (text === '') {
    if (required) addIssue('Ingresá un valor.');
    return null;
  }
  const value = Number(text);
  if (!INTEGER_PATTERN.test(text)) {
    addIssue('Ingresá un número entero.');
    return null;
  }
  const [min, max] = NUMERIC_RANGES[field];
  if (value < min || value > max) {
    addIssue(`Debe estar entre ${min} y ${max}.`);
    return null;
  }
  return value;
}

export interface PlanFormPayload {
  service: Service;
  kind: PlanKind;
  slug: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  periodMonths?: number;
  periodDays?: number;
  sessionsIncluded?: number;
  durationMinutes?: number;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  autoDebitEnabled: boolean;
}

export const planFormSchema = z
  .object({
    service: z.enum(['performance', 'rehab', 'recovery']),
    kind: z.enum(['period_plan', 'session_pack', 'single_session', 'evaluation']),
    name: z.string().trim().min(2, 'Ingresá al menos 2 caracteres.').max(80, 'Máximo 80 caracteres.'),
    slug: z
      .string()
      .trim()
      .min(1, 'Ingresá un identificador.')
      .max(80, 'Máximo 80 caracteres.')
      .regex(SLUG_PATTERN, 'Usá minúsculas, números y guiones.'),
    description: z.string().trim().max(500, 'Máximo 500 caracteres.'),
    features: z.string(),
    price: z.string(),
    periodMonths: z.string(),
    periodDays: z.string(),
    sessionsIncluded: z.string(),
    durationMinutes: z.string(),
    sortOrder: z.string(),
    featured: z.boolean(),
    active: z.boolean(),
    autoDebitEnabled: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: keyof typeof values) => (message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    if (!KINDS_BY_SERVICE[values.service].includes(values.kind)) {
      issue('kind')('El tipo no corresponde al servicio.');
    }
    const features = parseFeatures(values.features);
    if (features.length > MAX_FEATURES || features.some((feature) => feature.length > MAX_FEATURE_LENGTH)) {
      issue('features')(`Hasta ${MAX_FEATURES} características de ${MAX_FEATURE_LENGTH} caracteres.`);
    }
    readInteger(values.price, 'price', true, issue('price'));
    readInteger(values.sortOrder, 'sortOrder', false, issue('sortOrder'));
    for (const [field, usage] of Object.entries(KIND_FIELDS[values.kind]) as [NumericPlanField, FieldUsage][]) {
      if (usage !== 'hidden') readInteger(values[field], field, usage === 'required', issue(field));
    }
  })
  .transform((values): PlanFormPayload => {
    const silent = () => undefined;
    const usage = KIND_FIELDS[values.kind];
    const numeric = (field: NumericPlanField): Partial<Record<NumericPlanField, number>> => {
      if (usage[field] === 'hidden') return {};
      const value = readInteger(values[field], field, false, silent);
      return value === null ? {} : { [field]: value };
    };
    return {
      service: values.service,
      kind: values.kind,
      slug: values.slug,
      name: values.name,
      description: values.description,
      features: parseFeatures(values.features),
      price: readInteger(values.price, 'price', true, silent) ?? 0,
      ...numeric('periodMonths'),
      ...numeric('periodDays'),
      ...numeric('sessionsIncluded'),
      ...numeric('durationMinutes'),
      featured: values.featured,
      active: values.active,
      sortOrder: readInteger(values.sortOrder, 'sortOrder', false, silent) ?? 0,
      autoDebitEnabled: AUTO_DEBIT_KINDS.includes(values.kind) && values.autoDebitEnabled,
    };
  });

export type PlanFormInput = z.input<typeof planFormSchema>;

export function emptyPlanFormValues(): PlanFormInput {
  return {
    service: 'performance',
    kind: 'period_plan',
    name: '',
    slug: '',
    description: '',
    features: '',
    price: '',
    periodMonths: '',
    periodDays: '',
    sessionsIncluded: '',
    durationMinutes: '',
    sortOrder: '0',
    featured: false,
    active: true,
    autoDebitEnabled: false,
  };
}

const text = (value: number | null): string => (value === null ? '' : String(value));

export function planToFormValues(plan: PlanDto): PlanFormInput {
  return {
    service: plan.service,
    kind: plan.kind,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    features: plan.features.join('\n'),
    price: String(plan.price),
    periodMonths: text(plan.periodMonths),
    periodDays: text(plan.periodDays),
    sessionsIncluded: text(plan.sessionsIncluded),
    durationMinutes: text(plan.durationMinutes),
    sortOrder: String(plan.sortOrder),
    featured: plan.featured,
    active: plan.active,
    autoDebitEnabled: plan.autoDebitEnabled,
  };
}
