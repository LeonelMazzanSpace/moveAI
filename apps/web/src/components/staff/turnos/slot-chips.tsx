import { buttonVariants } from '@/components/ui/button';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

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
            className={cn(buttonVariants({ variant: selected ? 'default' : 'outline', size: 'lg' }), slot.cancelledAt && 'line-through opacity-60')}
          >
            {formatTime(slot.startsAt)}
          </button>
        );
      })}
    </div>
  );
}
