import { z } from 'zod';
import type { SettingsDto } from '@/lib/api/types';

export const PROLONGED_NOT_ABOVE_MESSAGE = 'Debe ser mayor que los días sin asistir.';

type NumericRuleKey = Exclude<keyof SettingsDto, 'checkinMonthlyEnabled' | 'valuesProvisional'>;

interface RuleField {
  name: NumericRuleKey;
  label: string;
  min: number;
  max: number;
  step: number;
  integer: boolean;
}

export const RULE_FIELDS: RuleField[] = [
  { name: 'cancelLimitHours', label: 'Horas para cancelar', min: 0, max: 72, step: 1, integer: true },
  { name: 'bookingWindowDays', label: 'Días de reserva anticipada', min: 1, max: 60, step: 1, integer: true },
  { name: 'pendingPaymentMinutes', label: 'Minutos de reserva pendiente de pago', min: 5, max: 120, step: 1, integer: true },
  { name: 'reconcileAfterMinutes', label: 'Minutos para conciliar pagos', min: 5, max: 1440, step: 1, integer: true },
  { name: 'expiringSoonDays', label: 'Días para "por vencer"', min: 1, max: 30, step: 1, integer: true },
  { name: 'noAttendanceDays', label: 'Días sin asistir', min: 3, max: 60, step: 1, integer: true },
  { name: 'prolongedInactivityDays', label: 'Días de inactividad prolongada', min: 7, max: 180, step: 1, integer: true },
  { name: 'frequencyDropRatio', label: 'Ratio de baja de frecuencia', min: 0.1, max: 0.9, step: 0.05, integer: false },
  { name: 'frequencyRecentWeeks', label: 'Semanas recientes de frecuencia', min: 1, max: 8, step: 1, integer: true },
  { name: 'frequencyBaselineWeeks', label: 'Semanas previas de referencia', min: 2, max: 26, step: 1, integer: true },
];

const REQUIRED_NUMBER = 'Ingresá un número.';
const rangeMessage = (min: number, max: number) => `Debe estar entre ${min} y ${max}.`;

function ruleNumber({ min, max, integer }: RuleField) {
  const base = z.number({ error: REQUIRED_NUMBER });
  return (integer ? base.int('Ingresá un número entero.') : base).min(min, rangeMessage(min, max)).max(max, rangeMessage(min, max));
}

const fieldByName = Object.fromEntries(RULE_FIELDS.map((field) => [field.name, field])) as Record<NumericRuleKey, RuleField>;
const prolongedField = fieldByName.prolongedInactivityDays;

export const rulesFormSchema = z
  .object({
    cancelLimitHours: ruleNumber(fieldByName.cancelLimitHours),
    bookingWindowDays: ruleNumber(fieldByName.bookingWindowDays),
    pendingPaymentMinutes: ruleNumber(fieldByName.pendingPaymentMinutes),
    reconcileAfterMinutes: ruleNumber(fieldByName.reconcileAfterMinutes),
    expiringSoonDays: ruleNumber(fieldByName.expiringSoonDays),
    noAttendanceDays: ruleNumber(fieldByName.noAttendanceDays),
    prolongedInactivityDays: z.number({ error: REQUIRED_NUMBER }).int('Ingresá un número entero.'),
    frequencyDropRatio: ruleNumber(fieldByName.frequencyDropRatio),
    frequencyRecentWeeks: ruleNumber(fieldByName.frequencyRecentWeeks),
    frequencyBaselineWeeks: ruleNumber(fieldByName.frequencyBaselineWeeks),
    checkinMonthlyEnabled: z.boolean(),
    confirmed: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const { prolongedInactivityDays, noAttendanceDays } = values;
    const fail = (message: string) => ctx.addIssue({ code: 'custom', path: ['prolongedInactivityDays'], message });
    if (prolongedInactivityDays <= noAttendanceDays) return fail(PROLONGED_NOT_ABOVE_MESSAGE);
    if (prolongedInactivityDays < prolongedField.min || prolongedInactivityDays > prolongedField.max) {
      fail(rangeMessage(prolongedField.min, prolongedField.max));
    }
  });

export type RulesFormInput = z.input<typeof rulesFormSchema>;
export type RulesFormValues = z.output<typeof rulesFormSchema>;

export function settingsToFormValues(settings: SettingsDto): RulesFormInput {
  return {
    cancelLimitHours: settings.cancelLimitHours,
    bookingWindowDays: settings.bookingWindowDays,
    pendingPaymentMinutes: settings.pendingPaymentMinutes,
    reconcileAfterMinutes: settings.reconcileAfterMinutes,
    expiringSoonDays: settings.expiringSoonDays,
    noAttendanceDays: settings.noAttendanceDays,
    prolongedInactivityDays: settings.prolongedInactivityDays,
    frequencyDropRatio: settings.frequencyDropRatio,
    frequencyRecentWeeks: settings.frequencyRecentWeeks,
    frequencyBaselineWeeks: settings.frequencyBaselineWeeks,
    checkinMonthlyEnabled: settings.checkinMonthlyEnabled,
    confirmed: false,
  };
}

export function changedSettings(values: RulesFormValues, current: SettingsDto): Partial<SettingsDto> {
  const changes: Partial<SettingsDto> = {};
  for (const { name } of RULE_FIELDS) {
    if (values[name] !== current[name]) changes[name] = values[name];
  }
  if (values.checkinMonthlyEnabled !== current.checkinMonthlyEnabled) {
    changes.checkinMonthlyEnabled = values.checkinMonthlyEnabled;
  }
  if (values.confirmed && current.valuesProvisional) changes.valuesProvisional = false;
  return changes;
}
