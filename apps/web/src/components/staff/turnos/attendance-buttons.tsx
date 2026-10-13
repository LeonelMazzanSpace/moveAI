import { useId } from 'react';
import type { AttendanceStatus } from '@/lib/api/types';
import { moveButton } from '@/components/move/button-styles';
import { cn } from '@/lib/utils';

export const ATTENDANCE_HINT = 'Disponible desde el día del turno';

interface AttendanceOption {
  status: AttendanceStatus;
  short: string;
  label: string;
  title?: string;
  activeClass: string;
  hoverClass: string;
}

const OPTIONS: AttendanceOption[] = [
  { status: 'present', short: 'P', label: 'Presente', activeClass: 'bg-success-muted text-success', hoverClass: 'hover:bg-success-muted hover:text-success' },
  { status: 'absent', short: 'A', label: 'Ausente', title: 'Ausente: avisó fuera de plazo', activeClass: 'bg-danger-muted text-danger', hoverClass: 'hover:bg-danger-muted hover:text-danger' },
  { status: 'no_show', short: 'NS', label: 'No show', title: 'No show: no avisó', activeClass: 'bg-danger-muted text-danger', hoverClass: 'hover:bg-danger-muted hover:text-danger' },
];

interface AttendanceButtonsProps {
  value: AttendanceStatus | null;
  canMark: boolean;
  /** Why marking is not available yet; read by assistive technology and shown as a tooltip while `canMark` is false. */
  hint?: string;
  onMark: (status: AttendanceStatus) => void;
}

export function AttendanceButtons({ value, canMark, hint, onMark }: AttendanceButtonsProps) {
  const hintId = useId();
  const showHint = !canMark && hint !== undefined;
  return (
    <span className="inline-flex gap-1" title={showHint ? hint : undefined}>
      {showHint ? (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      ) : null}
      {OPTIONS.map((option) => {
        const active = value === option.status;
        return (
          <button
            key={option.status}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            aria-describedby={showHint ? hintId : undefined}
            title={option.title}
            disabled={!canMark}
            onClick={() => onMark(option.status)}
            className={moveButton({
              variant: active ? 'ghost' : 'outline',
              className: active ? cn(option.activeClass, option.hoverClass) : cn('text-muted-foreground', canMark && option.hoverClass),
            })}
          >
            {option.short}
          </button>
        );
      })}
    </span>
  );
}
