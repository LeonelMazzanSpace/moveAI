import Link from 'next/link';
import { Suspense } from 'react';
import { PageContainer } from '@/components/move/page-container';
import { ContactDetails } from '@/components/public/contact-section';
import { loadContact } from '@/components/public/load-contact';
import { hasContactData } from '@/lib/contact';

const FOOTER_LINKS = [
  { label: 'Performance', href: '/performance' },
  { label: 'Rehab', href: '/rehab' },
  { label: 'Recovery', href: '/recovery' },
];

export async function FooterContact() {
  const contact = await loadContact();
  if (!contact || !hasContactData(contact)) return null;

  return (
    <div className="border-b border-border">
      <PageContainer className="py-10">
        <ContactDetails contact={contact} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" />
        {contact.mapsUrl ? (
          <a
            href={contact.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
          >
            Abrir en Google Maps
          </a>
        ) : null}
      </PageContainer>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <Suspense fallback={null}>
        <FooterContact />
      </Suspense>
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
