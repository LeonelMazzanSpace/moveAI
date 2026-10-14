'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ErrorState } from '@/components/move/error-state';
import { BUTTON_PRIMARY, FormField, fieldA11y } from '@/components/staff/form-primitives';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { applyFieldErrors } from '@/lib/api/field-errors';
import type { StaffContactInfoDto } from '@/lib/api/types';
import {
  CONTACT_FIELD_NAMES,
  changedContact,
  contactFormSchema,
  contactToFormValues,
  type ContactFormInput,
  type ContactFormValues,
} from './contact-form.schema';

const CONTACT_KEY = ['staff', 'settings', 'contact'] as const;

interface ContactFieldSpec {
  name: (typeof CONTACT_FIELD_NAMES)[number];
  label: string;
  placeholder?: string;
  hint?: string;
  inputMode?: 'tel' | 'email' | 'url';
}

const CONTACT_FIELDS: readonly ContactFieldSpec[] = [
  { name: 'address', label: 'Dirección' },
  { name: 'hours', label: 'Horarios' },
  { name: 'whatsapp', label: 'WhatsApp', placeholder: '+598 99 123 456', inputMode: 'tel' },
  { name: 'instagram', label: 'Instagram', placeholder: '@usuario' },
  { name: 'email', label: 'Email de contacto', inputMode: 'email' },
  { name: 'mapsUrl', label: 'Enlace de Google Maps', placeholder: 'https://', inputMode: 'url' },
  {
    name: 'staffNotificationsEmail',
    label: 'Email para avisos del staff',
    hint: 'Recibe los avisos de reservas de Rehab y de Google Calendar.',
    inputMode: 'email',
  },
];

function ContactForm({ contact }: { contact: StaffContactInfoDto }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setError, formState } = useForm<ContactFormInput, unknown, ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contactToFormValues(contact),
  });
  const { errors } = formState;

  const save = useMutation({
    mutationFn: (body: Partial<StaffContactInfoDto>) =>
      apiFetch<StaffContactInfoDto>('/staff/settings/contact', { method: 'PATCH', body }),
    onSuccess: (updated) => {
      toast.success('Contacto guardado.');
      reset(contactToFormValues(updated));
      return queryClient.invalidateQueries({ queryKey: CONTACT_KEY });
    },
    onError: (error) => {
      applyFieldErrors(error, CONTACT_FIELD_NAMES, setError);
      toast.error(errorMessage(error));
    },
  });

  function onValid(values: ContactFormValues) {
    const changes = changedContact(values, contact);
    if (Object.keys(changes).length === 0) {
      toast.info('No hay cambios para guardar.');
      return;
    }
    save.mutate(changes);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Estos datos también aparecen al pie de los mails a clientes.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CONTACT_FIELDS.map((field) => {
          const id = `${uid}-${field.name}`;
          const message = errors[field.name]?.message;
          const hintId = field.hint ? `${id}-hint` : undefined;
          return (
            <div key={field.name} className="space-y-1.5">
              <FormField id={id} label={field.label} error={message}>
                <Input
                  id={id}
                  inputMode={field.inputMode}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  {...fieldA11y(id, message, hintId)}
                  {...register(field.name)}
                />
              </FormField>
              {field.hint ? (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {field.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div>
        <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
          Guardar
        </button>
      </div>
    </form>
  );
}

export function ContactTab() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: CONTACT_KEY,
    queryFn: () => apiFetch<StaffContactInfoDto>('/staff/settings/contact'),
  });

  if (isPending) return <Skeleton className="h-80 max-w-3xl" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <ContactForm contact={data} />;
}
