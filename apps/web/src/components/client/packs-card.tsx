'use client';

import { CtaLink } from '@/components/public/hero';
import { EmptyState } from '@/components/move/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { PackDto } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useMySubscriptions } from './plan-card';

const PACKS_HREF = '/planes?service=recovery';

function sessionsLabel(count: number): string {
  return count === 1 ? '1 sesión' : `${count} sesiones`;
}

export function PacksCard({ packs }: { packs: PackDto[] }) {
  if (packs.length === 0) {
    return (
      <EmptyState
        title="No tenés paquetes Recovery"
        description="Con un paquete reservás tus sesiones de Recovery con saldo."
        action={<CtaLink href={PACKS_HREF}>Ver paquetes</CtaLink>}
      />
    );
  }

  return (
    <div className="rounded border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-7 py-4">
        <h2 className="text-sm font-semibold">Paquetes Recovery</h2>
        <CtaLink href={PACKS_HREF} variant="outline">
          Comprar otro
        </CtaLink>
      </div>
      <ul className="divide-y divide-border">
        {packs.map((pack) => (
          <li key={pack.id} className="flex items-center justify-between gap-4 px-7 py-4">
            <div>
              <p className="text-sm font-medium">{pack.planName}</p>
              <p className="text-xs text-muted-foreground">{`Vence el ${formatDate(pack.endsOn)}`}</p>
            </div>
            <p className="text-right text-sm">
              <span className="font-display text-lg font-black">{pack.sessionsLeft}</span>
              <span className="text-xs text-muted-foreground">{` de ${sessionsLabel(pack.sessionsTotal)}`}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PacksSection() {
  const { data, isPending, isError } = useMySubscriptions();
  if (isPending) return <Skeleton className="h-28 w-full" />;
  // La consulta es la misma que la de `ClientPlanSection`, que ya muestra el error con su reintento.
  if (isError) return null;
  return <PacksCard packs={data.recoveryPacks} />;
}
