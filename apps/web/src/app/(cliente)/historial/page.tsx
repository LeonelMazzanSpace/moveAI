import type { Metadata } from 'next';
import { ActivityList } from '@/components/client/activity-list';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = { title: 'Historial' };

export default function HistoryPage() {
  return (
    <PageContainer className="py-12">
      <Eyebrow>Mi cuenta</Eyebrow>
      <div className="mt-3">
        <DisplayTitle as="h1">Historial.</DisplayTitle>
      </div>
      <div className="mt-10">
        <ActivityList variant="full" />
      </div>
    </PageContainer>
  );
}
