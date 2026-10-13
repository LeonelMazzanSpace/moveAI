import type { TimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SlotListProps {
  slots: TimeSlotDto[];
  value: string | null;
  onChange: (slotId: string) => void;
}

export function SlotList({ slots, value, onChange }: SlotListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => (
        <button
          key={slot.id}
          type="button"
          disabled={slot.isFull || slot.bookedByMe}
          aria-pressed={slot.id === value}
          onClick={() => onChange(slot.id)}
          className={cn(
            'rounded border px-3.5 py-1.5 text-xs',
            slot.id === value
              ? 'border-transparent bg-primary font-bold text-primary-foreground'
              : 'border-border font-medium hover:bg-soft',
            'disabled:pointer-events-none disabled:border-border/50 disabled:text-muted-foreground/40',
            slot.isFull && 'line-through',
          )}
        >
          {formatTime(slot.startsAt)}
        </button>
      ))}
    </div>
  );
}
