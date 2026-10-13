'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StatusBadge } from '@/components/move/status-badge';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, FormField, fieldA11y } from '@/components/staff/form-primitives';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { applyFieldErrors } from '@/lib/api/field-errors';
import type { ProfessionalDto } from '@/lib/api/types';

const PROFESSIONALS_KEY = ['staff', 'professionals'] as const;

const professionalSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá al menos 2 caracteres.').max(80, 'Máximo 80 caracteres.'),
});
type ProfessionalValues = z.infer<typeof professionalSchema>;
const PROFESSIONAL_FIELDS: readonly (keyof ProfessionalValues)[] = ['name'];

export function ProfessionalsTab() {
  const uid = useId();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setError, formState } = useForm<ProfessionalValues>({
    resolver: zodResolver(professionalSchema),
    defaultValues: { name: '' },
  });
  const { data, error, isPending, refetch } = useQuery({
    queryKey: PROFESSIONALS_KEY,
    queryFn: () => apiFetch<ProfessionalDto[]>('/staff/professionals'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: PROFESSIONALS_KEY });
  const onError = (mutationError: unknown) => toast.error(errorMessage(mutationError));

  const create = useMutation({
    mutationFn: (body: ProfessionalValues) => apiFetch<ProfessionalDto>('/staff/professionals', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Profesional agregado.');
      reset();
      return refresh();
    },
    onError: (mutationError) => {
      applyFieldErrors(mutationError, PROFESSIONAL_FIELDS, setError);
      onError(mutationError);
    },
  });
  const toggle = useMutation({
    mutationFn: (professional: ProfessionalDto) =>
      apiFetch<ProfessionalDto>(`/staff/professionals/${professional.id}`, { method: 'PATCH', body: { active: !professional.active } }),
    onSuccess: refresh,
    onError,
  });

  if (isPending) return <Skeleton className="h-60" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="max-w-3xl space-y-8">
      <form
        onSubmit={handleSubmit((values) => create.mutate(values))}
        noValidate
        className="flex flex-wrap items-start gap-3"
      >
        <div className="min-w-60 flex-1">
          <FormField id={`${uid}-name`} label="Nombre del profesional" error={formState.errors.name?.message}>
            <Input
              id={`${uid}-name`}
              autoComplete="off"
              {...fieldA11y(`${uid}-name`, formState.errors.name?.message)}
              {...register('name')}
            />
          </FormField>
        </div>
        <button type="submit" className={`${BUTTON_PRIMARY} mt-[26px]`} disabled={create.isPending}>
          Agregar
        </button>
      </form>

      {data.length === 0 ? (
        <EmptyState title="Sin profesionales" description="Agregá a quienes atienden Rehab para poder crear sus turnos." />
      ) : (
        <div className="rounded border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((professional) => (
                <TableRow key={professional.id}>
                  <TableCell className="font-medium">{professional.name}</TableCell>
                  <TableCell>
                    <StatusBadge tone={professional.active ? 'success' : 'neutral'}>
                      {professional.active ? 'Activo' : 'Inactivo'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <button type="button" className={BUTTON_OUTLINE} disabled={toggle.isPending} onClick={() => toggle.mutate(professional)}>
                        {professional.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
