import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { moveButton } from '@/components/move/button-styles';

export const BUTTON_PRIMARY = moveButton();
export const BUTTON_OUTLINE = moveButton({ variant: 'outline' });
export const BUTTON_DANGER = moveButton({ variant: 'destructive' });
export const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20';
export const CHECKBOX_CLASS = 'size-4 accent-primary';

/** Upper bound for prices and payment amounts (D38). */
export const MAX_MONEY_AMOUNT = 10_000_000;

/** Whole numbers typed as text: digits only, so `1e3`, `0x10`, `1.5` and signs are rejected. */
export const INTEGER_PATTERN = /^\d+$/;

const errorId = (id: string): string => `${id}-error`;

/**
 * `aria-invalid` and `aria-describedby` for the control of a `FormField` that shows `error`; `hintId` is the id of a hint
 * paragraph next to the field, which stays linked whether or not there is an error.
 */
export function fieldA11y(id: string, error?: string, hintId?: string): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  const describedBy = [error ? errorId(id) : null, hintId ?? null].filter((part) => part !== null).join(' ');
  return {
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={errorId(id)} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
