'use client';

import { useQuery } from '@tanstack/react-query';
import { CtaLink } from '@/components/public/hero';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { NoticeDto, NoticeKind } from '@/lib/api/types';

const ACTION_LABEL: Partial<Record<NoticeKind, string>> = {
  plan_expiring: 'Renovar plan',
  plan_expired: 'Renovar plan',
  checkin_pending: 'Responder check-in',
  pack_low: 'Ver paquetes',
};

function NoticesBody() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['me', 'notices'],
    queryFn: () => apiFetch<NoticeDto[]>('/me/notices'),
  });

  if (isPending) return <Skeleton className="mt-5 h-24" />;
  if (isError) return <div className="mt-5"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  if (data.length === 0) {
    return <div className="mt-5"><EmptyState title="Sin avisos" description="Cuando haya novedades sobre tu plan las vas a ver acá." /></div>;
  }
  return (
    <ul className="mt-5 space-y-4 text-sm">
      {data.map((notice) => (
        <li key={notice.id} className="rounded border border-border bg-soft p-4">
          <p className="font-medium">{notice.title}</p>
          {notice.body ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notice.body}</p> : null}
          {notice.actionUrl && ACTION_LABEL[notice.kind] ? (
            <div className="mt-3">
              <CtaLink href={notice.actionUrl} variant="outline">
                {ACTION_LABEL[notice.kind]}
              </CtaLink>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function NoticesPanel() {
  return (
    <section id="avisos" className="scroll-mt-24 rounded border border-border bg-card p-6">
      <h2 className="text-sm font-semibold">Avisos</h2>
      <NoticesBody />
    </section>
  );
}
