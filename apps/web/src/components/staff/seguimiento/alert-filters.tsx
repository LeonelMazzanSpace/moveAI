import type { AlertCountsDto, AlertType } from '@/lib/api/types';
import { moveButton } from '@/components/move/button-styles';
import { ALERT_LABEL, ALERT_ORDER } from './alert-labels';

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
        className={moveButton({ variant: selected === null ? 'default' : 'outline' })}
      >
        {chipLabel('Todas', counts?.total)}
      </button>
      {ALERT_ORDER.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={selected === type}
          onClick={() => onSelect(type)}
          className={moveButton({ variant: selected === type ? 'default' : 'outline', className: selected === type ? undefined : TONE_CLASS[type] })}
        >
          {chipLabel(ALERT_LABEL[type], counts?.[type])}
        </button>
      ))}
    </div>
  );
}
