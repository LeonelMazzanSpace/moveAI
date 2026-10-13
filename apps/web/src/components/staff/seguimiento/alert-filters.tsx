import type { AlertCountsDto, AlertType } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ALERT_LABEL, ALERT_ORDER } from './alert-labels';

const CHIP_CLASS = 'rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em]';

const TONE_CLASS: Partial<Record<AlertType, string>> = {
  expiring: 'border-warning/40 text-warning',
  expired: 'border-danger/40 text-danger',
};

interface AlertFiltersProps {
  counts: AlertCountsDto | undefined;
  selected: AlertType | null;
  onSelect: (type: AlertType | null) => void;
}

function chipLabel(label: string, count: number | undefined): string {
  return count === undefined ? label : `${label} · ${count}`;
}

export function AlertFilters({ counts, selected, onSelect }: AlertFiltersProps) {
  return (
    <div role="group" aria-label="Filtrar alertas" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={cn(CHIP_CLASS, selected === null ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground')}
      >
        {chipLabel('Todas', counts?.total)}
      </button>
      {ALERT_ORDER.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={selected === type}
          onClick={() => onSelect(type)}
          className={cn(
            CHIP_CLASS,
            selected === type
              ? 'bg-primary text-primary-foreground'
              : cn('border', TONE_CLASS[type] ?? 'border-border text-muted-foreground hover:text-foreground'),
          )}
        >
          {chipLabel(ALERT_LABEL[type], counts?.[type])}
        </button>
      ))}
    </div>
  );
}
