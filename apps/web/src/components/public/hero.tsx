import Link from 'next/link';
import type { ReactNode } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { cn } from '@/lib/utils';

interface CtaLinkProps {
  href: string;
  variant?: 'primary' | 'outline';
  children: ReactNode;
}

export function CtaLink({ href, variant = 'primary', children }: CtaLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex w-fit rounded px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
        variant === 'primary' ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-card',
      )}
    >
      {children}
    </Link>
  );
}

interface HeroProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  size?: 'hero' | 'xl';
  children?: ReactNode;
}

export function Hero({ eyebrow, title, description, size = 'xl', children }: HeroProps) {
  return (
    <section>
      <PageContainer className="pb-16 pt-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <div className="mt-5">
          <DisplayTitle as="h1" size={size}>
            {title}
          </DisplayTitle>
        </div>
        <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children}
      </PageContainer>
    </section>
  );
}
