import type { Metadata } from 'next';
import { FollowupBooking } from '@/components/booking/followup-booking';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = { title: 'Reservar seguimiento fisioterapéutico' };

export default function FollowupBookingPage() {
  return (
    <PageContainer className="max-w-3xl py-16">
      <Eyebrow>Fisioterapia</Eyebrow>
      <div className="mt-5">
        <DisplayTitle as="h1" size="xl">
          Seguimiento.
        </DisplayTitle>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Elegí fecha y horario para tu próxima sesión de seguimiento.</p>
      <div className="mt-10 rounded border border-border bg-card p-7">
        <FollowupBooking />
      </div>
    </PageContainer>
  );
}
