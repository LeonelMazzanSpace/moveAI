import { cn } from '@/lib/utils';

export const CLIENT_STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'no_plan', label: 'Sin plan' },
] as const;

export type ClientStatusFilter = (typeof CLIENT_STATUS_FILTERS)[number]['value'];

export function parseStatusFilter(value: string | null): ClientStatusFilter {
  return CLIENT_STATUS_FILTERS.find((filter) => filter.value === value)?.value ?? 'all';
}

interface StatusFilterProps {
  value: ClientStatusFilter;
  onChange: (value: ClientStatusFilter) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
      {CLIENT_STATUS_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={filter.value === value}
          onClick={() => onChange(filter.value)}
          className={cn(
            'rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em]',
            filter.value === value
              ? 'bg-primary text-primary-foreground'
              : 'border border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
