'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { guestSchema, type GuestValues } from './guest-form.schema';

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-sm';

interface GuestFormProps {
  onSubmit: (values: GuestValues) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function GuestForm({ onSubmit, isSubmitting = false, submitLabel = 'Continuar' }: GuestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestValues>({ resolver: zodResolver(guestSchema) });

  return (
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-5">
      <div>
        <Label htmlFor="guest-name" className="text-xs text-muted-foreground">
          Nombre
        </Label>
        <Input
          id="guest-name"
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          className={FIELD_CLASS}
          {...register('name')}
        />
        {errors.name ? <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p> : null}
      </div>
      <div>
        <Label htmlFor="guest-email" className="text-xs text-muted-foreground">
          Email
        </Label>
        <Input
          id="guest-email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          aria-invalid={errors.email ? true : undefined}
          className={FIELD_CLASS}
          {...register('email')}
        />
        {errors.email ? <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p> : null}
      </div>
      <div>
        <Label htmlFor="guest-phone" className="text-xs text-muted-foreground">
          Teléfono
        </Label>
        <Input
          id="guest-phone"
          type="tel"
          autoComplete="tel"
          aria-invalid={errors.phone ? true : undefined}
          className={FIELD_CLASS}
          {...register('phone')}
        />
        {errors.phone ? <p className="mt-1.5 text-xs text-danger">{errors.phone.message}</p> : null}
      </div>
      <Button type="submit" disabled={isSubmitting} className={moveButtonSize({ size: 'block' })}>
        {submitLabel}
      </Button>
    </form>
  );
}
