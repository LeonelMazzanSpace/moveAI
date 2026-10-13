import type { ReactNode } from 'react';
import { DisplayTitle } from './display-title';

export function StaffPageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <DisplayTitle as="h1" size="lg">
        {title}
      </DisplayTitle>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
