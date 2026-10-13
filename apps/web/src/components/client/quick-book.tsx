import Link from 'next/link';
import { cn } from '@/lib/utils';

interface QuickBookProps {
  rehabFollowupEnabled: boolean;
}

const LINK_CLASSES =
  'flex w-full items-center justify-between rounded px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.2em]';

export function QuickBook({ rehabFollowupEnabled }: QuickBookProps) {
  const options = [
    { label: 'Performance', href: '/reservar', primary: true },
    { label: 'Recovery', href: '/recovery#reservar', primary: false },
    ...(rehabFollowupEnabled ? [{ label: 'Fisioterapia', href: '/reservar/fisioterapia', primary: false }] : []),
  ];

  return (
    <div className="rounded border border-border bg-card p-6">
      <h2 className="text-sm font-semibold">Reservar</h2>
      <div className="mt-5 space-y-3">
        {options.map(({ label, href, primary }) => (
          <Link
            key={label}
            href={href}
            className={cn(LINK_CLASSES, primary ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-soft')}
          >
            {label}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
