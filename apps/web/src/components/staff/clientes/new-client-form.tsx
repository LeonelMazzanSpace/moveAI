'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { ClientRowDto } from '@/lib/api/types';
import { newClientSchema, toNewClientPayload, type NewClientValues } from './new-client.schema';

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-sm';

export function NewClientForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewClientValues>({ resolver: zodResolver(newClientSchema), defaultValues: { name: '', email: '', phone: '' } });
  const create = useMutation({
    mutationFn: (values: NewClientValues) =>
      apiFetch<ClientRowDto>('/staff/clients', { method: 'POST', body: toNewClientPayload(values) }),
  });

  async function onSubmit(values: NewClientValues) {
    try {
      const client = await create.mutateAsync(values);
      toast.success('Cliente creado. Le enviamos un email para activar su cuenta.');
      await queryClient.invalidateQueries({ queryKey: ['staff', 'clients'] });
      router.push(`/staff/clientes/${client.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_REGISTERED') {
        setError('email', { message: errorMessage(error) });
        return;
      }
      setError('root', { message: errorMessage(error) });
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5 rounded border border-border bg-card p-7">
      <div>
        <Label htmlFor="client-name" className="text-xs text-muted-foreground">
          Nombre y apellido
        </Label>
        <Input
          id="client-name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          className={FIELD_CLASS}
          {...register('name')}
        />
        {errors.name ? <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p> : null}
      </div>
      <div>
        <Label htmlFor="client-email" className="text-xs text-muted-foreground">
          Email
        </Label>
        <Input
          id="client-email"
          type="email"
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          className={FIELD_CLASS}
          {...register('email')}
        />
        {errors.email ? <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p> : null}
      </div>
      <div>
        <Label htmlFor="client-phone" className="text-xs text-muted-foreground">
          Teléfono (opcional)
        </Label>
        <Input
          id="client-phone"
          type="tel"
          autoComplete="off"
          aria-invalid={errors.phone ? true : undefined}
          className={FIELD_CLASS}
          {...register('phone')}
        />
        {errors.phone ? <p className="mt-1.5 text-xs text-danger">{errors.phone.message}</p> : null}
      </div>
      {errors.root ? (
        <p role="alert" className="text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="h-auto px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
        Crear cliente
      </Button>
    </form>
  );
}
