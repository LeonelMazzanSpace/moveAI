import Link from 'next/link';
import { moveButton } from '@/components/move/button-styles';

interface QuickBookProps {
  rehabFollowupEnabled: boolean;
}

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
            className={moveButton({ variant: primary ? 'default' : 'outline', size: 'cta', className: 'w-full justify-between' })}
          >
            {label}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
