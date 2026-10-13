import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ServiceCard {
  label: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  primary: boolean;
}

const SERVICES: ServiceCard[] = [
  {
    label: 'Performance',
    title: 'Entrenamiento semi personalizado.',
    description:
      'Planes con acceso por reserva, sin límite semanal de asistencias. Cada horario con capacidad máxima controlada.',
    ctaLabel: 'Ver planes',
    href: '/planes?service=performance',
    primary: true,
  },
  {
    label: 'Rehab',
    title: 'Fisioterapia y readaptación.',
    description:
      'Evaluación y Diagnóstico como puerta de entrada. Reservá tu evaluación online, seas o no alumno de MOVE.',
    ctaLabel: 'Agendar evaluación',
    href: '/rehab#reservar',
    primary: false,
  },
  {
    label: 'Recovery',
    title: 'Recovery Room by MOVE.',
    description: 'Sesiones individuales y paquetes mensuales, abiertos a clientes y público general. Reservá y pagá online.',
    ctaLabel: 'Reservar sesión',
    href: '/recovery#reservar',
    primary: false,
  },
];

export function ServiceCards() {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {SERVICES.map((service) => (
        <div key={service.label} className="flex flex-col rounded border border-border bg-card p-7">
          <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">{service.label}</span>
          <h3 className="mt-4 font-display text-2xl font-extrabold uppercase leading-tight">{service.title}</h3>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
          <Link
            href={service.href}
            className={cn(
              'mt-7 inline-flex w-fit rounded px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em]',
              service.primary ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-soft',
            )}
          >
            {service.ctaLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}
