import { initials } from '@/lib/format';
import { LogoutButton } from './logout-button';

export function StaffTopbar({ name }: { name: string }) {
  return (
    <header className="flex h-16 items-center justify-end gap-3 border-b border-border px-8">
      <span className="text-xs font-medium">{name}</span>
      <div className="flex size-8 items-center justify-center rounded-full bg-card text-xs font-semibold">
        {initials(name)}
      </div>
      <LogoutButton />
    </header>
  );
}
