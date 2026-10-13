import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepperProps {
  steps: readonly string[];
  /** Paso actual, desde 1; los anteriores se muestran completados. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {steps.map((label, index) => {
        const position = index + 1;
        const done = position < current;
        const active = position === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded border text-[11px]',
                active || done ? 'border-transparent bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {done ? <Check className="size-3.5" aria-label="Completado" /> : position}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
