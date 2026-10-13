import { z } from 'zod';
import { MAX_MONEY_AMOUNT } from '@/components/staff/form-primitives';
import type { PaymentMethod, PlanDto } from '@/lib/api/types';

export type ManualPaymentMethod = Extract<PaymentMethod, 'cash' | 'transfer'>;

export const MANUAL_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export const MANUAL_METHODS = Object.keys(MANUAL_METHOD_LABEL) as ManualPaymentMethod[];

const MAX_NOTE_LENGTH = 500;
// Plain decimal with up to two decimals: no exponent, hex, sign or bare dot (`Number()` would accept all of them).
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const TOO_MANY_DECIMALS = /^\d+\.\d{3,}$/;

function invalidAmountMessage(text: string, amount: number): string {
  if (amount < 0) return 'El monto no puede ser negativo.';
  if (TOO_MANY_DECIMALS.test(text)) return 'Usá hasta 2 decimales.';
  return 'Ingresá un monto válido.';
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
    if (text === '') {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Ingresá un monto.' });
      return;
    }
    if (!AMOUNT_PATTERN.test(text)) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: invalidAmountMessage(text, amount) });
      return;
    }
    if (amount > MAX_MONEY_AMOUNT) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'El monto no puede superar $ 10.000.000.' });
      return;
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
