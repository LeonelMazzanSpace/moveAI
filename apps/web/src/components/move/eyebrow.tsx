import type { ReactNode } from 'react';

export function Eyebrow({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
      {index ? `${index} — ` : null}
      {children}
    </p>
  );
}
