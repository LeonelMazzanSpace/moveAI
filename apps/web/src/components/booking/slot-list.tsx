import type { TimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
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
            buttonVariants({ variant: slot.id === value ? 'default' : 'outline', size: 'lg' }),
            slot.isFull && 'line-through',
          )}
        >
          {formatTime(slot.startsAt)}
        </button>
      ))}
    </div>
  );
}
