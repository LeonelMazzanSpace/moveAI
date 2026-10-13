'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { resetSchema, type ResetValues } from './schemas';

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-sm';
const LINK_CLASS = 'underline underline-offset-2';

function InvalidLink({ message }: { message: string }) {
  return (
    <div role="alert" className="space-y-3 text-sm text-muted-foreground">
      <p>{message}</p>
      <Link href="/recuperar" className={LINK_CLASS}>
        Pedir un link nuevo
      </Link>
    </div>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<'idle' | 'done' | 'invalid' | 'error'>('idle');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  if (!token) return <InvalidLink message="El link para restablecer tu contraseña no es válido." />;
  if (status === 'invalid') return <InvalidLink message="El link venció o ya fue usado." />;

  if (status === 'done') {
    return (
      <div role="status" className="space-y-3 text-sm text-muted-foreground">
        <p>Listo, ya podés ingresar.</p>
        <Link href="/ingresar" className={LINK_CLASS}>
          Ir a ingresar
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetValues) {
    if (!token) return;
    try {
      const { error } = await authClient.resetPassword({ newPassword: values.password, token });
      if (!error) return setStatus('done');
      setStatus(error.code === 'INVALID_TOKEN' ? 'invalid' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <Label htmlFor="reset-password" className="text-xs text-muted-foreground">
          Nueva contraseña
        </Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          aria-invalid={errors.password ? true : undefined}
          className={FIELD_CLASS}
          {...register('password')}
        />
        {errors.password ? <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p> : null}
      </div>
      <div>
        <Label htmlFor="reset-confirm" className="text-xs text-muted-foreground">
          Repetí la contraseña
        </Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          className={FIELD_CLASS}
          {...register('confirm')}
        />
        {errors.confirm ? <p className="mt-1.5 text-xs text-danger">{errors.confirm.message}</p> : null}
      </div>
      {status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          No pudimos restablecer tu contraseña. Probá de nuevo en unos minutos.
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className={moveButtonSize({ size: 'block' })}>
        Restablecer contraseña
      </Button>
    </form>
  );
}
