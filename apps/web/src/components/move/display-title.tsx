import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TitleSize = 'hero' | 'xl' | 'lg';

const SIZE_CLASSES: Record<TitleSize, string> = {
  hero: 'text-5xl md:text-7xl',
  xl: 'text-4xl',
  lg: 'text-3xl',
};

interface DisplayTitleProps {
  as?: 'h1' | 'h2' | 'h3';
  size?: TitleSize;
  children: ReactNode;
}

export function DisplayTitle({ as: Tag = 'h2', size = 'xl', children }: DisplayTitleProps) {
  return <Tag className={cn('font-display font-black uppercase tracking-tight', SIZE_CLASSES[size])}>{children}</Tag>;
}
