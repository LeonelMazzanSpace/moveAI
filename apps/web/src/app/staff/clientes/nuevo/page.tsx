import type { Metadata } from 'next';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { NewClientForm } from '@/components/staff/clientes/new-client-form';

export const metadata: Metadata = { title: 'Nuevo cliente' };

export default function NewClientPage() {
  return (
    <>
      <StaffPageHeader title="Nuevo cliente" />
      <NewClientForm />
    </>
  );
}
