import { initials } from '@/lib/format';
import { LogoutButton } from './logout-button';
import { StaffMobileNav } from './staff-mobile-nav';

export function StaffTopbar({ name }: { name: string }) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 md:justify-end md:px-8">
      <StaffMobileNav name={name} />
      <div className="flex items-center gap-3">
        <span className="hidden text-xs font-medium md:inline">{name}</span>
        <div className="flex size-8 items-center justify-center rounded-full bg-card text-xs font-semibold">
          {initials(name)}
        </div>
        <LogoutButton className="hidden md:inline-block" />
      </div>
    </header>
  );
}
