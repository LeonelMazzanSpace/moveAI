import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';

const STEPS = [
  {
    title: 'Entrenamiento terapéutico',
    description: 'El equipo define si corresponde readaptación mediante entrenamiento dentro de MOVE.',
  },
  {
    title: 'Tratamiento en consultorio',
    description: 'Sesiones de fisioterapia en consultorio, o una combinación con entrenamiento.',
  },
  {
    title: 'Seguimiento fisioterapéutico',
    description: 'Frecuencia y modalidad definidas individualmente luego del contacto o evaluación inicial.',
  },
];

export function RehabNextSteps() {
  return (
    <section className="border-t border-border">
      <PageContainer className="py-14">
        <DisplayTitle size="lg">¿Qué pasa después de la evaluación?</DisplayTitle>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded border border-border bg-card p-6">
              <p className="text-base font-semibold">{step.title}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Los tratamientos posteriores no se comercializan automáticamente desde la web — el equipo de MOVE define el camino
          luego de la evaluación.
        </p>
      </PageContainer>
    </section>
  );
}
