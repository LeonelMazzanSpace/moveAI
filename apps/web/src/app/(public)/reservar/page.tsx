import type { Metadata } from 'next';
import Link from 'next/link';
import { FollowupCard } from '@/components/booking/followup-booking';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = {
  title: 'Reservar',
  description: 'Elegí el servicio y reservá tu turno en MOVE: Performance, Rehab o Recovery.',
};

const SERVICES = [
  {
    name: 'Performance',
    description: 'Entrenamiento semi personalizado. Reservá tu horario con un plan vigente.',
    href: '/performance#horarios',
  },
  {
    name: 'Rehab',
    description: 'Evaluación y diagnóstico con reserva de turno y pago online.',
    href: '/rehab#reservar',
  },
  {
    name: 'Recovery',
    description: 'Sesiones de recuperación individuales o en paquete.',
    href: '/recovery#reservar',
  },
];

export default function BookingHubPage() {
  return (
    <PageContainer className="py-16">
      <Eyebrow>Reservas</Eyebrow>
      <div className="mt-5">
        <DisplayTitle as="h1" size="xl">
          ¿Qué querés reservar?
        </DisplayTitle>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {SERVICES.map((service) => (
          <Link key={service.name} href={service.href} className="rounded border border-border bg-card p-7 hover:bg-soft">
            <p className="font-display text-2xl font-black uppercase tracking-tight">{service.name}</p>
            <p className="mt-3 text-sm text-muted-foreground">{service.description}</p>
          </Link>
        ))}
        <FollowupCard />
      </div>
    </PageContainer>
  );
}
