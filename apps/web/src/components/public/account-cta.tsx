import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { CtaLink } from './hero';

export function AccountCta() {
  return (
    <section className="border-t border-border bg-soft">
      <PageContainer className="flex flex-wrap items-center justify-between gap-6 py-14">
        <div>
          <Eyebrow index="03">Tu cuenta</Eyebrow>
          <div className="mt-4">
            <DisplayTitle size="lg">¿Ya sos parte de MOVE?</DisplayTitle>
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Accedé a tu perfil para ver tu plan, renovar, reservar y consultar tu historial.
          </p>
        </div>
        <div className="flex gap-3">
          <CtaLink href="/perfil">Ir a mi perfil</CtaLink>
          <CtaLink href="/registro" variant="outline">
            Crear cuenta
          </CtaLink>
        </div>
      </PageContainer>
    </section>
  );
}
