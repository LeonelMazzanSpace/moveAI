import type { ReactNode } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { hasContactData, instagramUrl, mailtoUrl, whatsappUrl } from '@/lib/contact';
import type { ContactInfoDto } from '@/lib/api/types';
import { CtaLink } from './hero';

function ContactLink({ href, children }: { href: string | null; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} className="inline-flex min-h-8 items-center hover:text-foreground">
      {children}
    </a>
  );
}

/** The contact data that is filled in, as label / value pairs. Empty fields are left out. */
export function ContactDetails({ contact, className }: { contact: ContactInfoDto; className?: string }) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (contact.address) rows.push({ label: 'Dirección', value: contact.address });
  if (contact.hours) rows.push({ label: 'Horarios', value: contact.hours });
  if (contact.whatsapp) {
    rows.push({ label: 'WhatsApp', value: <ContactLink href={whatsappUrl(contact.whatsapp)}>{contact.whatsapp}</ContactLink> });
  }
  if (contact.instagram) {
    rows.push({ label: 'Instagram', value: <ContactLink href={instagramUrl(contact.instagram)}>{contact.instagram}</ContactLink> });
  }
  if (contact.email) {
    rows.push({ label: 'Email', value: <ContactLink href={mailtoUrl(contact.email)}>{contact.email}</ContactLink> });
  }

  return (
    <dl className={className}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">{row.label}</dt>
          <dd className="mt-1 text-sm text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContactSection({ contact }: { contact: ContactInfoDto | null }) {
  if (!contact || !hasContactData(contact)) return null;
  const whatsapp = whatsappUrl(contact.whatsapp);

  return (
    <section id="contacto" className="scroll-mt-20 border-t border-border bg-soft">
      <PageContainer className="py-20">
        <Eyebrow index="04">Contacto</Eyebrow>
        <div className="mt-4">
          <DisplayTitle>Dónde estamos</DisplayTitle>
        </div>
        <ContactDetails contact={contact} className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-2" />
        {contact.mapsUrl || whatsapp ? (
          <div className="mt-10 flex flex-wrap gap-3">
            {contact.mapsUrl ? <CtaLink href={contact.mapsUrl}>Abrir en Google Maps</CtaLink> : null}
            {whatsapp ? (
              <CtaLink href={whatsapp} variant="outline">
                Escribinos por WhatsApp
              </CtaLink>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </section>
  );
}
