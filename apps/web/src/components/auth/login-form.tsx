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
import { loginSchema, type LoginValues } from './schemas';

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-sm';
const BAD_CREDENTIALS_STATUSES = [400, 401, 403, 422];
const BAD_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos.';
const GENERIC_MESSAGE = 'No pudimos ingresar. Probá de nuevo en unos minutos.';

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const { error } = await authClient.signIn.email({ email: values.email, password: values.password });
      if (error) {
        setFormError(BAD_CREDENTIALS_STATUSES.includes(error.status) ? BAD_CREDENTIALS_MESSAGE : GENERIC_MESSAGE);
        return;
      }
      router.push(withNext('/continuar', next));
    } catch {
      setFormError(GENERIC_MESSAGE);
    }
  }

  return (
    <div className="mt-6 rounded border border-border bg-card p-7">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label htmlFor="login-email" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Input
            id="login-email"
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
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs text-muted-foreground">
              Contraseña
            </Label>
            <Link href="/recuperar" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            className={FIELD_CLASS}
            {...register('password')}
          />
          {errors.password ? <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p> : null}
        </div>
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="h-auto w-full py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
          Ingresar
        </Button>
      </form>
      <GoogleButton />
    </div>
  );
}
