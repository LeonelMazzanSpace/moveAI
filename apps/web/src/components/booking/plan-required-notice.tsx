import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PlanRequiredNotice({ renewHref }: { renewHref: string }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-soft px-5 py-4 text-xs leading-relaxed"
    >
      <p>
        <span className="font-semibold">Tu plan no está vigente para esa fecha.</span>{' '}
        <span className="text-muted-foreground">Renová para seguir reservando.</span>
      </p>
      <Link
        href={renewHref}
        className={cn(buttonVariants({ size: 'sm' }), 'text-[10px] font-semibold uppercase tracking-[0.2em]')}
      >
        Renovar plan
      </Link>
    </div>
  );
}
