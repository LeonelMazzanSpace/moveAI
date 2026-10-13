import type { Metadata } from 'next';
import { CheckinsView } from '@/components/staff/checkins/checkins-view';

export const metadata: Metadata = { title: 'Check-in de clientes' };

export default function CheckinsPage() {
  return <CheckinsView />;
}
