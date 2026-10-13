'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { withNext } from '@/lib/auth/post-login';
import { GoogleButton } from './google-button';
import { registerSchema, type RegisterValues } from './schemas';

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-sm';
const GENERIC_MESSAGE = 'No pudimos crear tu cuenta. Probá de nuevo en unos minutos.';

type FormError = 'email-taken' | 'generic' | null;

interface AuthErrorShape {
  status: number;
  code?: string;
}

function isEmailTaken(error: AuthErrorShape): boolean {
  return error.status === 422 || error.code?.startsWith('USER_ALREADY_EXISTS') === true;
}

export function RegisterForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [formError, setFormError] = useState<FormError>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { phone: '' } });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      const { error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
        ...(values.phone ? { phone: values.phone } : {}),
      });
      if (error) {
        setFormError(isEmailTaken(error) ? 'email-taken' : 'generic');
        return;
      }
      router.push(withNext('/continuar', next));
    } catch {
      setFormError('generic');
    }
  }

  return (
    <div className="mt-6 rounded border border-border bg-card p-7">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label htmlFor="register-name" className="text-xs text-muted-foreground">
            Nombre y apellido
          </Label>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Tu nombre"
            aria-invalid={errors.name ? true : undefined}
            className={FIELD_CLASS}
            {...register('name')}
          />
          {errors.name ? <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="register-email" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Input
            id="register-email"
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
          <Label htmlFor="register-phone" className="text-xs text-muted-foreground">
            Teléfono (opcional)
          </Label>
          <Input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            placeholder="099 123 456"
            aria-invalid={errors.phone ? true : undefined}
            className={FIELD_CLASS}
            {...register('phone')}
          />
          {errors.phone ? <p className="mt-1.5 text-xs text-danger">{errors.phone.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="register-password" className="text-xs text-muted-foreground">
            Contraseña
          </Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            aria-invalid={errors.password ? true : undefined}
            className={FIELD_CLASS}
            {...register('password')}
          />
          {errors.password ? <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p> : null}
        </div>
        {formError === 'email-taken' ? (
          <p role="alert" className="text-sm text-danger">
            Ya existe una cuenta con ese email.{' '}
            <Link href={withNext('/ingresar', next)} className="underline underline-offset-2">
              Ingresá
            </Link>
          </p>
        ) : null}
        {formError === 'generic' ? (
          <p role="alert" className="text-sm text-danger">
            {GENERIC_MESSAGE}
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="h-auto w-full py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
          Crear cuenta
        </Button>
      </form>
      <GoogleButton />
    </div>
  );
}
