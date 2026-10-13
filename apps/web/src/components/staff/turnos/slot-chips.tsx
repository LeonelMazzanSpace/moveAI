import type { StaffTimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

// Kept only for staff/dashboard/dashboard-view.tsx, which still imports it from here.
export { SERVICE_LABEL as SERVICE_NAMES } from '@/lib/format';

interface SlotChipsProps {
  slots: StaffTimeSlotDto[];
  selectedId: string | null;
  onSelect: (slotId: string) => void;
}

export function SlotChips({ slots, selectedId, onSelect }: SlotChipsProps) {
  return (
    <div role="group" aria-label="Turnos del día" className="flex flex-wrap gap-2">
      {slots.map((slot) => {
        const selected = slot.id === selectedId;
        return (
          <button
            key={slot.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(slot.id)}
            className={cn(
              'rounded px-3.5 py-1.5 text-xs font-semibold',
              selected ? 'bg-primary text-primary-foreground' : 'border border-border bg-card',
              slot.cancelledAt && 'line-through opacity-60',
            )}
          >
            {formatTime(slot.startsAt)}
          </button>
        );
      })}
    </div>
  );
}
