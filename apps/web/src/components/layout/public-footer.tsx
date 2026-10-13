import Link from 'next/link';
import { PageContainer } from '@/components/move/page-container';

const FOOTER_LINKS = [
  { label: 'Performance', href: '/performance' },
  { label: 'Rehab', href: '/rehab' },
  { label: 'Recovery', href: '/recovery' },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <PageContainer className="flex flex-wrap items-center justify-between gap-4 py-10 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        <span className="font-display text-base font-black normal-case tracking-tight text-foreground">
          MOVE<span className="align-super text-[9px]">®</span>
        </span>
        <div className="flex gap-7">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
        <span>© 2026 MOVE Strength &amp; Conditioning</span>
      </PageContainer>
    </footer>
  );
}
