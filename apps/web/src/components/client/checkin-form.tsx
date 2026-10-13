'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { CheckinFlag, PendingCheckinDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { checkinSchema, toCheckinAnswers, type CheckinAnswers, type CheckinFormValues } from './checkin-form.schema';

const PENDING_KEY = ['me', 'checkins', 'pending'];

interface ChoiceOption {
  value: string;
  label: string;
}

interface ChoicesProps {
  legend: string;
  options: ChoiceOption[];
  registration: UseFormRegisterReturn;
  error?: string;
}

function Choices({ legend, options, registration, error }: ChoicesProps) {
  return (
    <fieldset className="mt-6">
      <legend className="text-xs font-medium">{legend}</legend>
      <div className={cn('mt-3 grid gap-2 text-center text-xs', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input type="radio" value={option.value} className="peer sr-only" {...registration} />
            <span className="block rounded border border-border py-2 text-muted-foreground peer-checked:border-transparent peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </fieldset>
  );
}

const FEELING_OPTIONS: ChoiceOption[] = [
  { value: 'struggling', label: 'Me cuesta' },
  { value: 'good', label: 'Bien' },
  { value: 'very_good', label: 'Muy bien' },
];
const PAIN_OPTIONS: ChoiceOption[] = [
  { value: 'none', label: 'No' },
  { value: 'mild', label: 'Sí, leve' },
];
const GOALS_OPTIONS: ChoiceOption[] = [
  { value: 'same', label: 'Siguen igual' },
  { value: 'adjust', label: 'Quiero ajustarlos' },
];

const FIELD_CLASS = 'mt-2 h-auto rounded border-border bg-soft px-3.5 py-2.5 text-xs';

interface CheckinFormProps {
  firstName: string;
  onSubmit: (answers: CheckinAnswers) => Promise<void>;
}

export function CheckinForm({ firstName, onSubmit }: CheckinFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckinFormValues>({
    resolver: zodResolver(checkinSchema),
    defaultValues: { painDetail: '', goalsDetail: '' },
  });
  const pain = useWatch({ control, name: 'pain' });
  const goals = useWatch({ control, name: 'goals' });

  async function submit(values: CheckinFormValues) {
    setFormError(null);
    try {
      await onSubmit(toCheckinAnswers(values));
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="rounded border border-border bg-card p-6">
      <h2 className="font-display text-2xl font-extrabold uppercase leading-tight">{`¿Cómo venís, ${firstName}?`}</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Check-in mensual · te toma 1 minuto y nos ayuda a acompañarte mejor.
      </p>

      <Choices legend="¿Cómo te sentís con el entrenamiento?" options={FEELING_OPTIONS} registration={register('feeling')} error={errors.feeling?.message} />

      <Choices legend="¿Sentiste alguna molestia o dolor?" options={PAIN_OPTIONS} registration={register('pain')} error={errors.pain?.message} />
      {pain === 'mild' ? (
        <div className="mt-3">
          <Label htmlFor="checkin-pain-detail" className="text-xs text-muted-foreground">
            ¿Dónde?
          </Label>
          <Input
            id="checkin-pain-detail"
            placeholder="Contanos dónde (ej.: rodilla derecha)…"
            maxLength={500}
            aria-invalid={errors.painDetail ? true : undefined}
            className={FIELD_CLASS}
            {...register('painDetail')}
          />
          {errors.painDetail ? <p className="mt-1.5 text-xs text-danger">{errors.painDetail.message}</p> : null}
        </div>
      ) : null}

      <Choices legend="¿Cambiaron tus objetivos?" options={GOALS_OPTIONS} registration={register('goals')} error={errors.goals?.message} />
      {goals === 'adjust' ? (
        <div className="mt-3">
          <Label htmlFor="checkin-goals-detail" className="text-xs text-muted-foreground">
            ¿Qué te gustaría cambiar?
          </Label>
          <Textarea id="checkin-goals-detail" maxLength={500} className={cn(FIELD_CLASS, 'min-h-20')} {...register('goalsDetail')} />
          {errors.goalsDetail ? <p className="mt-1.5 text-xs text-danger">{errors.goalsDetail.message}</p> : null}
        </div>
      ) : null}

      {formError ? (
        <p role="alert" className="mt-5 text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting || sent} className="mt-7 h-auto w-full py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
        Enviar respuesta
      </Button>
    </form>
  );
}

export function CheckinPanel() {
  const queryClient = useQueryClient();
  const [thanked, setThanked] = useState(false);
  const pending = useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => apiFetch<{ checkin: PendingCheckinDto | null }>('/me/checkins/pending'),
  });
  const answer = useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: CheckinAnswers }) =>
      apiFetch<{ flag: CheckinFlag }>(`/me/checkins/${id}`, { method: 'POST', body: answers }),
  });

  async function submit(checkin: PendingCheckinDto, answers: CheckinAnswers) {
    try {
      await answer.mutateAsync({ id: checkin.id, answers });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'CHECKIN_ALREADY_ANSWERED') throw error;
      toast.error(errorMessage(error));
      queryClient.setQueryData(PENDING_KEY, { checkin: null });
      return;
    }
    setThanked(true);
    queryClient.setQueryData(PENDING_KEY, { checkin: null });
    await queryClient.invalidateQueries({ queryKey: ['me', 'notices'] });
  }

  if (thanked) {
    return (
      <div role="status" className="rounded border border-border bg-card p-6 text-center">
        <p className="font-display text-lg font-extrabold uppercase leading-snug">¡Gracias! El equipo de MOVE revisa tus respuestas.</p>
      </div>
    );
  }
  if (pending.isError) return <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />;
  if (pending.isPending) return <Skeleton className="h-96" />;

  const checkin = pending.data.checkin;
  if (!checkin) {
    return <EmptyState title="No tenés check-ins pendientes." description="Cuando haya uno nuevo, te avisamos por email y desde tu perfil." />;
  }
  return <CheckinForm key={checkin.id} firstName={checkin.firstName} onSubmit={(answers) => submit(checkin, answers)} />;
}
