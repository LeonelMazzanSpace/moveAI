import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MoveButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
type MoveButtonSize = 'compact' | 'cta' | 'block';

interface MoveButtonSizeOptions {
  size?: MoveButtonSize;
  className?: string;
}

interface MoveButtonOptions extends MoveButtonSizeOptions {
  variant?: MoveButtonVariant;
}

/** MOVE lettering (small, uppercase, tracked) on top of the shared button variants; the only place that spells it out. */
const MOVE_LETTERING = 'h-auto text-[10px] font-semibold uppercase tracking-[0.2em]';

const SIZE_CLASS: Record<MoveButtonSize, string> = {
  compact: 'px-3.5 py-1.5',
  cta: 'px-5 py-2.5',
  block: 'w-full py-2.5',
};

/** The lettering and padding of a MOVE button, for the `className` of a `Button` (which brings its own variant). */
export function moveButtonSize({ size = 'compact', className }: MoveButtonSizeOptions = {}): string {
  return cn(MOVE_LETTERING, SIZE_CLASS[size], className);
}

/** Class names for a link or `<button>` that looks like a MOVE button. */
export function moveButton({ variant = 'default', ...sizeOptions }: MoveButtonOptions = {}): string {
  return cn(buttonVariants({ variant }), moveButtonSize(sizeOptions));
}
