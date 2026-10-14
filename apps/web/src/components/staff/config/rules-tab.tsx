'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ErrorState } from '@/components/move/error-state';
import { StatusBadge } from '@/components/move/status-badge';
import { BUTTON_PRIMARY, CHECKBOX_CLASS, FormField, fieldA11y } from '@/components/staff/form-primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { applyFieldErrors } from '@/lib/api/field-errors';
import type { SettingsDto } from '@/lib/api/types';
import {
  changedSettings,
  RULE_FIELDS,
  rulesFormSchema,
  settingsToFormValues,
  type RulesFormInput,
  type RulesFormValues,
} from './rules-form.schema';

const SETTINGS_KEY = ['staff', 'settings'] as const;
const RULES_FIELDS: readonly (keyof RulesFormInput)[] = [...RULE_FIELDS.map((field) => field.name), 'checkinMonthlyEnabled'];

function RulesForm({ settings }: { settings: SettingsDto }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setError, formState } = useForm<RulesFormInput, unknown, RulesFormValues>({
    resolver: zodResolver(rulesFormSchema),
    defaultValues: settingsToFormValues(settings),
  });
  const { errors } = formState;

  const save = useMutation({
    mutationFn: (body: Partial<SettingsDto>) => apiFetch<SettingsDto>('/staff/settings', { method: 'PATCH', body }),
    onSuccess: (updated) => {
      toast.success('Reglas guardadas.');
      reset(settingsToFormValues(updated));
      return queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
    onError: (error) => {
      applyFieldErrors(error, RULES_FIELDS, setError);
      toast.error(errorMessage(error));
    },
  });

  function onValid(values: RulesFormValues) {
    const changes = changedSettings(values, settings);
    if (Object.keys(changes).length === 0) {
      toast.info('No hay cambios para guardar.');
      return;
    }
    save.mutate(changes);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="max-w-3xl space-y-6">
      {settings.valuesProvisional ? (
        <div className="flex flex-wrap items-center gap-4 rounded border border-border bg-warning-muted px-4 py-3">
          <StatusBadge tone="warning">Valores provisorios — confirmar con MOVE</StatusBadge>
          <Label htmlFor={`${uid}-confirmed`} className="min-h-8 text-sm">
            <input id={`${uid}-confirmed`} type="checkbox" className={CHECKBOX_CLASS} {...register('confirmed')} />
            Marcar los valores como confirmados
          </Label>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {RULE_FIELDS.map((field) => (
          <FormField key={field.name} id={`${uid}-${field.name}`} label={field.label} error={errors[field.name]?.message}>
            <Input
              id={`${uid}-${field.name}`}
              type="number"
              inputMode="decimal"
              step={field.step}
              {...fieldA11y(`${uid}-${field.name}`, errors[field.name]?.message)}
              {...register(field.name, { valueAsNumber: true })}
            />
          </FormField>
        ))}
      </div>
      <Label htmlFor={`${uid}-checkin`} className="min-h-8 text-sm">
        <input id={`${uid}-checkin`} type="checkbox" className={CHECKBOX_CLASS} {...register('checkinMonthlyEnabled')} />
        Enviar el check-in mensual
      </Label>
      <div>
        <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
          Guardar
        </button>
      </div>
    </form>
  );
}

export function RulesTab() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<SettingsDto>('/staff/settings'),
  });

  if (isPending) return <Skeleton className="h-80 max-w-3xl" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <RulesForm settings={data} />;
}
