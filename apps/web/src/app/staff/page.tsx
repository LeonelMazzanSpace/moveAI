import type { Metadata } from 'next';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { DashboardView } from '@/components/staff/dashboard/dashboard-view';

export const metadata: Metadata = { title: 'Dashboard' };

export default function StaffDashboardPage() {
  return (
    <>
      <StaffPageHeader title="Dashboard" />
      <DashboardView />
    </>
  );
}
