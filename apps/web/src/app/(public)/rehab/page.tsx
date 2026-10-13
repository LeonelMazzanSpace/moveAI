import type { Metadata } from 'next';
import { Hero } from '@/components/public/hero';
import { RehabNextSteps } from '@/components/public/rehab-next-steps';

export const metadata: Metadata = {
  title: 'Rehab',
  description:
    'Evaluación y Diagnóstico: la puerta de entrada a la fisioterapia de MOVE, abierta a alumnos y a personas externas.',
};

export default function RehabPage() {
  return (
    <>
      <Hero
        eyebrow="02 — Rehab"
        title={
          <>
            Evaluación y
            <br />
            diagnóstico.
          </>
        }
        description="La Evaluación y Diagnóstico es la puerta de entrada a los servicios de fisioterapia de MOVE. Abierta a alumnos y a personas externas — si todavía no tenés cuenta, se genera durante el proceso."
      />
      <section id="reservar" className="border-t border-border bg-soft" />
      <RehabNextSteps />
    </>
  );
}
