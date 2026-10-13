import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';

const STEPS = [
  { title: 'Selección', description: 'Elegí sesión individual o paquete mensual.' },
  { title: 'Reserva', description: 'Elegí fecha y horario disponibles en el calendario.' },
  { title: 'Pago', description: 'Pagá online de forma segura con Mercado Pago.' },
  { title: 'Confirmación', description: 'Recibís la confirmación y queda asociada a tu perfil.' },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border">
      <PageContainer className="py-16">
        <DisplayTitle size="lg">Así funciona la reserva.</DisplayTitle>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded border border-border bg-card p-6">
              <span className="font-display text-3xl font-black text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
              <p className="mt-3 font-semibold">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded border border-border bg-soft px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          ¿Todavía no tenés cuenta? Se genera un usuario durante el proceso para empezar a consolidar tu historial dentro de
          MOVE.
        </div>
      </PageContainer>
    </section>
  );
}
