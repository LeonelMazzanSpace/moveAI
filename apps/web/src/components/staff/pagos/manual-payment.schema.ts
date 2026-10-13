import { z } from 'zod';
import type { PaymentMethod, PlanDto } from '@/lib/api/types';

export type ManualPaymentMethod = Extract<PaymentMethod, 'cash' | 'transfer'>;

export const MANUAL_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export const MANUAL_METHODS = Object.keys(MANUAL_METHOD_LABEL) as ManualPaymentMethod[];

const MAX_NOTE_LENGTH = 500;
export const MAX_AMOUNT = 10_000_000;

function hasMoreThanTwoDecimals(amount: number): boolean {
  return Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6;
}

export interface ManualPaymentPayload {
  userId: string;
  planId: string;
  method: ManualPaymentMethod;
  amount: number;
  note?: string;
}

export function isPayablePlan(plan: PlanDto): boolean {
  return plan.active && (plan.kind === 'period_plan' || plan.kind === 'session_pack');
}

export const manualPaymentSchema = z
  .object({
    clientId: z.string().min(1, 'Elegí un cliente.'),
    planId: z.string().min(1, 'Elegí un plan.'),
    method: z.enum(['cash', 'transfer']),
    amount: z.string(),
    note: z.string().trim().max(MAX_NOTE_LENGTH, `Máximo ${MAX_NOTE_LENGTH} caracteres.`),
  })
  .superRefine((values, ctx) => {
    const text = values.amount.trim();
    const amount = Number(text);
    if (text === '' || !Number.isFinite(amount)) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Ingresá un monto.' });
      return;
    }
    if (amount < 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'El monto no puede ser negativo.' });
      return;
    }
    if (amount > MAX_AMOUNT) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'El monto no puede superar $ 10.000.000.' });
      return;
    }
    if (hasMoreThanTwoDecimals(amount)) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Usá hasta 2 decimales.' });
    }
  })
  .transform((values): ManualPaymentPayload => {
    const payload: ManualPaymentPayload = {
      userId: values.clientId,
      planId: values.planId,
      method: values.method,
      amount: Number(values.amount),
    };
    return values.note === '' ? payload : { ...payload, note: values.note };
  });

export type ManualPaymentInput = z.input<typeof manualPaymentSchema>;

export const EMPTY_MANUAL_PAYMENT: ManualPaymentInput = {
  clientId: '',
  planId: '',
  method: 'cash',
  amount: '',
  note: '',
};
