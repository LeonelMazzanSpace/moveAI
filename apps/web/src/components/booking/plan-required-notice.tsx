import Link from 'next/link';
import { moveButton } from '@/components/move/button-styles';

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
        className={moveButton()}
      >
        Renovar plan
      </Link>
    </div>
  );
}
