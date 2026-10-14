'use client';

import { MobileNav, MobileNavAccount } from './mobile-nav';
import { STAFF_NAV_ITEMS } from './nav-items';
import { useStaffAlertsTotal } from './use-staff-alerts-total';

export function StaffMobileNav({ name }: { name: string }) {
  const alertsTotal = useStaffAlertsTotal();
  return (
    <MobileNav items={STAFF_NAV_ITEMS} alertsTotal={alertsTotal} footer={<MobileNavAccount name={name} />} breakpoint="lg" />
  );
}
