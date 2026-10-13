import type { AttendanceStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export const ATTENDANCE_HINT = 'Disponible desde el día del turno';

interface AttendanceOption {
  status: AttendanceStatus;
  short: string;
  label: string;
  activeClass: string;
  hoverClass: string;
}

const OPTIONS: AttendanceOption[] = [
  { status: 'present', short: 'P', label: 'Presente', activeClass: 'bg-success-muted text-success', hoverClass: 'hover:bg-success-muted hover:text-success' },
  { status: 'absent', short: 'A', label: 'Ausente', activeClass: 'bg-danger-muted text-danger', hoverClass: 'hover:bg-danger-muted hover:text-danger' },
  { status: 'no_show', short: 'NS', label: 'No show', activeClass: 'bg-danger-muted text-danger', hoverClass: 'hover:bg-danger-muted hover:text-danger' },
];

interface AttendanceButtonsProps {
  value: AttendanceStatus | null;
  canMark: boolean;
  onMark: (status: AttendanceStatus) => void;
}

export function AttendanceButtons({ value, canMark, onMark }: AttendanceButtonsProps) {
  return (
    <span className="inline-flex gap-1" title={canMark ? undefined : ATTENDANCE_HINT}>
      {OPTIONS.map((option) => {
        const active = value === option.status;
        return (
          <button
            key={option.status}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            disabled={!canMark}
            onClick={() => onMark(option.status)}
            className={cn(
              'rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50',
              active ? option.activeClass : cn('border border-border text-muted-foreground', canMark && option.hoverClass),
            )}
          >
            {option.short}
          </button>
        );
      })}
    </span>
  );
}
