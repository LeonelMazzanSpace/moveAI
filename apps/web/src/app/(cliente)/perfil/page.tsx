import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ActivityList } from '@/components/client/activity-list';
import { MonthSummary } from '@/components/client/month-summary';
import { NoticesPanel } from '@/components/client/notices-panel';
import { PacksSection } from '@/components/client/packs-card';
import { ClientPlanSection } from '@/components/client/plan-card';
import { QuickBook } from '@/components/client/quick-book';
import { UpcomingBookings } from '@/components/client/upcoming-bookings';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Mi perfil' };

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

async function ProfileContent() {
  const user = await requireRole('client', '/perfil');

  return (
    <>
      <Eyebrow>Mi perfil</Eyebrow>
      <div className="mt-3">
        <DisplayTitle as="h1">{`Hola, ${firstName(user.name)}.`}</DisplayTitle>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ClientPlanSection />
          <PacksSection />
          <UpcomingBookings />
          <ActivityList />
        </div>
        <div className="space-y-6">
          <QuickBook rehabFollowupEnabled={user.rehabFollowupEnabled} />
          <NoticesPanel />
          <MonthSummary />
        </div>
      </div>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-72" />
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <PageContainer className="py-12">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </PageContainer>
  );
}
