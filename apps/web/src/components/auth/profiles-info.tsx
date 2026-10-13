import { Eyebrow } from '@/components/move/eyebrow';
import { cn } from '@/lib/utils';

const PROFILES = [
  {
    label: 'Visitante',
    description: 'Consulta servicios, inicia reservas y puede registrarse durante el proceso.',
    highlighted: false,
  },
  {
    label: 'Cliente / Alumno',
    description: 'Gestiona sus planes, pagos, reservas, historial y comunicaciones.',
    highlighted: true,
  },
  {
    label: 'Staff MOVE',
    description: 'Administra clientes, servicios, turnos, asistencias, pagos y seguimientos.',
    highlighted: false,
  },
];

export function ProfilesInfo() {
  return (
    <section className="mx-auto mt-16 max-w-4xl">
      <div className="flex justify-center">
        <Eyebrow>Perfiles de la plataforma</Eyebrow>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {PROFILES.map((profile) => (
          <div key={profile.label} className="rounded border border-border bg-card p-6">
            <span
              className={cn(
                'inline-flex rounded border border-border bg-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
                profile.highlighted ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {profile.label}
            </span>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
