import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { ConfigurationTabs } from '@/components/staff/config/configuration-tabs';

export const metadata: Metadata = { title: 'Configuración' };

export default function ConfigurationPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  return (
    <>
      <StaffPageHeader title="Configuración" />
      <Suspense fallback={null}>
        <ConfigurationTabs searchParams={searchParams} />
      </Suspense>
    </>
  );
}
