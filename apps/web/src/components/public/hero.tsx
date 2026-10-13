import Link from 'next/link';
import type { ReactNode } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { moveButton } from '@/components/move/button-styles';
import { PageContainer } from '@/components/move/page-container';

interface CtaLinkProps {
  href: string;
  variant?: 'primary' | 'outline';
  children: ReactNode;
}

export function CtaLink({ href, variant = 'primary', children }: CtaLinkProps) {
  return (
    <Link
      href={href}
      className={moveButton({ variant: variant === 'primary' ? 'default' : 'outline', size: 'cta', className: 'w-fit' })}
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
