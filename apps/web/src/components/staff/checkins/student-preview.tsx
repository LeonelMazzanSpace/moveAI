import type { ReactNode } from 'react';

const PREVIEW_NAME = 'Martina';

function PreviewOption({ label, selected = false }: { label: string; selected?: boolean }) {
  return (
    <span
      className={
        selected
          ? 'rounded bg-primary py-2 font-semibold text-primary-foreground'
          : 'rounded border border-border py-2 text-muted-foreground'
      }
    >
      {label}
    </span>
  );
}

function PreviewQuestion({ question, columns, children }: { question: string; columns: 2 | 3; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="text-xs font-medium">{question}</p>
      <div className={`mt-3 grid gap-2 text-center text-xs ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>
    </div>
  );
}

export function StudentPreview() {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Vista previa — lo que ve el alumno</p>
      <div aria-hidden="true" className="mt-4 max-w-[360px] rounded border border-dashed border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-black tracking-tight">
            MOVE<span className="align-super text-[8px]">®</span>
          </span>
          <span className="rounded border border-border bg-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Vista del alumno
          </span>
        </div>
        <p className="mt-5 font-display text-xl font-extrabold uppercase leading-tight">¿Cómo venís, {PREVIEW_NAME}?</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Check-in mensual · te toma 1 minuto y nos ayuda a acompañarte mejor.
        </p>
        <PreviewQuestion question="¿Cómo te sentís con el entrenamiento?" columns={3}>
          <PreviewOption label="Me cuesta" />
          <PreviewOption label="Bien" selected />
          <PreviewOption label="Muy bien" />
        </PreviewQuestion>
        <PreviewQuestion question="¿Sentiste alguna molestia o dolor?" columns={2}>
          <PreviewOption label="No" />
          <PreviewOption label="Sí, leve" selected />
        </PreviewQuestion>
        <PreviewQuestion question="¿Cambiaron tus objetivos?" columns={2}>
          <PreviewOption label="Siguen igual" selected />
          <PreviewOption label="Quiero ajustarlos" />
        </PreviewQuestion>
        <span className="mt-7 block w-full rounded bg-primary py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground">
          Enviar respuesta
        </span>
      </div>
    </div>
  );
}
