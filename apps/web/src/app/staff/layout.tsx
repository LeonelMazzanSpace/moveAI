import { Suspense, type ReactNode } from 'react';
import { StaffSidebar } from '@/components/layout/staff-sidebar';
import { StaffTopbar } from '@/components/layout/staff-topbar';
import { requireRole } from '@/lib/auth/session';

const STAFF_AREA_PATH = '/staff';

async function StaffShell({ children }: { children: ReactNode }) {
  const user = await requireRole('staff', STAFF_AREA_PATH);
  return (
    <div className="flex flex-1">
      <StaffSidebar />
      <div className="min-w-0 flex-1">
        <StaffTopbar name={user.name} />
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
