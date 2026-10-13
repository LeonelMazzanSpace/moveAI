import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FollowupView } from '@/components/staff/seguimiento/followup-view';

export const metadata: Metadata = { title: 'Seguimiento y retención' };

export default function FollowupPage() {
  return (
    <Suspense fallback={null}>
      <FollowupView />
    </Suspense>
  );
}
