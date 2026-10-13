import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { PaymentsView, type PaymentFilters, type PaymentStatusFilter } from '@/components/staff/pagos/payments-view';
import type { PaymentMethod } from '@/lib/api/types';
import { clampPage } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Pagos' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUSES: PaymentStatusFilter[] = ['approved', 'pending', 'rejected', 'expired'];
const METHODS: PaymentMethod[] = ['mercadopago', 'cash', 'transfer'];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Awaited<SearchParams>): PaymentFilters {
  return {
    status: STATUSES.find((status) => status === first(params.estado)) ?? null,
    method: METHODS.find((method) => method === first(params.metodo)) ?? null,
    needsAttention: first(params.atencion) === '1',
    page: clampPage(first(params.pagina)),
  };
}

async function PaymentsContent({ searchParams }: { searchParams: SearchParams }) {
  return <PaymentsView filters={parseFilters(await searchParams)} />;
}

export default function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <StaffPageHeader title="Pagos" />
      <Suspense fallback={null}>
        <PaymentsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
