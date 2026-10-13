import type { ContactChannel, ContactDto, ContactOutcome } from '@/lib/api/types';
import { formatDate } from '@/lib/format';

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  email: 'Email',
  in_person: 'En persona',
};

const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  reached: 'Contactado',
  no_answer: 'No respondió',
  left_message: 'Dejó mensaje',
};

export function ContactsList({ contacts }: { contacts: ContactDto[] }) {
  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay contactos registrados.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {contacts.map((contact) => (
        <li key={contact.id} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm font-medium">{`${CHANNEL_LABEL[contact.channel]} · ${OUTCOME_LABEL[contact.outcome]}`}</p>
          {contact.note ? <p className="mt-1 text-sm text-muted-foreground">{contact.note}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{`${contact.staffName} · ${formatDate(contact.createdAt)}`}</p>
        </li>
      ))}
    </ul>
  );
}
