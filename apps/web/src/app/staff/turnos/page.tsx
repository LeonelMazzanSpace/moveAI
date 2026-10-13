import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TurnosView } from '@/components/staff/turnos/turnos-view';

export const metadata: Metadata = { title: 'Turnos y asistencia' };

export default function TurnosPage() {
  return (
    <Suspense fallback={null}>
      <TurnosView />
    </Suspense>
  );
}
