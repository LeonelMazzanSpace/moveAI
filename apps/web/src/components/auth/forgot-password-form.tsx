'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { forgotSchema, type ForgotValues } from './schemas';

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-sm';
const SENT_MESSAGE = 'Si el email está registrado, te enviamos un link para restablecer tu contraseña.';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: ForgotValues) {
    try {
      await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: `${window.location.origin}/restablecer`,
      });
    } catch {
      // Same answer either way so the form never reveals whether the email exists.
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="text-sm leading-relaxed text-muted-foreground">
        {SENT_MESSAGE}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <Label htmlFor="forgot-email" className="text-xs text-muted-foreground">
          Email
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          aria-invalid={errors.email ? true : undefined}
          className={FIELD_CLASS}
          {...register('email')}
        />
        {errors.email ? <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p> : null}
      </div>
      <Button type="submit" disabled={isSubmitting} className={moveButtonSize({ size: 'block' })}>
        Enviar link
      </Button>
    </form>
  );
}
