import type { Metadata } from 'next';
import { CheckinPanel } from '@/components/client/checkin-form';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = { title: 'Check-in' };

export default function CheckinPage() {
  return (
    <PageContainer className="py-12">
      <div className="mx-auto max-w-md">
        <Eyebrow>Mi cuenta</Eyebrow>
        <div className="mt-6">
          <CheckinPanel />
        </div>
      </div>
    </PageContainer>
  );
}
