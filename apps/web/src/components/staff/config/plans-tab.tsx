'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StatusBadge } from '@/components/move/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { PlanDto, Service } from '@/lib/api/types';
import { formatUYU, SERVICE_LABEL } from '@/lib/format';
import { BUTTON_DANGER, BUTTON_OUTLINE, BUTTON_PRIMARY, PlanForm } from './plan-form';
import { KIND_LABEL, SERVICES, type PlanFormPayload } from './plan-form.schema';

const PLANS_KEY = ['staff', 'plans'] as const;

type PlanDialog = { type: 'create' } | { type: 'edit'; plan: PlanDto } | { type: 'delete'; plan: PlanDto };

function periodSummary(plan: PlanDto): string {
  if (plan.kind === 'period_plan') return `${plan.periodMonths} ${plan.periodMonths === 1 ? 'mes' : 'meses'}`;
  if (plan.kind === 'session_pack') return `${plan.sessionsIncluded} sesiones · ${plan.periodDays} días`;
  return `${plan.durationMinutes} min`;
}

type PlanUpdateBody = Omit<PlanFormPayload, 'service' | 'kind'>;

function updateBody(payload: PlanFormPayload): PlanUpdateBody {
  return {
    slug: payload.slug,
    name: payload.name,
    description: payload.description,
    features: payload.features,
    price: payload.price,
    ...(payload.periodMonths === undefined ? {} : { periodMonths: payload.periodMonths }),
    ...(payload.periodDays === undefined ? {} : { periodDays: payload.periodDays }),
    ...(payload.sessionsIncluded === undefined ? {} : { sessionsIncluded: payload.sessionsIncluded }),
    ...(payload.durationMinutes === undefined ? {} : { durationMinutes: payload.durationMinutes }),
    featured: payload.featured,
    active: payload.active,
    sortOrder: payload.sortOrder,
  };
}

interface ServiceTableProps {
  service: Service;
  plans: PlanDto[];
  onEdit: (plan: PlanDto) => void;
  onToggle: (plan: PlanDto) => void;
  onDelete: (plan: PlanDto) => void;
}

function ServiceTable({ service, plans, onEdit, onToggle, onDelete }: ServiceTableProps) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-black uppercase tracking-tight">{SERVICE_LABEL[service]}</h2>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay planes de {SERVICE_LABEL[service]}.</p>
      ) : (
        <div className="rounded border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Período / sesiones</TableHead>
                <TableHead>Destacado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{KIND_LABEL[plan.kind]}</TableCell>
                  <TableCell>{formatUYU(plan.price)}</TableCell>
                  <TableCell>{periodSummary(plan)}</TableCell>
                  <TableCell>{plan.featured ? 'Sí' : '—'}</TableCell>
                  <TableCell>
                    <StatusBadge tone={plan.active ? 'success' : 'neutral'}>{plan.active ? 'Activo' : 'Inactivo'}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <button type="button" className={BUTTON_OUTLINE} onClick={() => onEdit(plan)}>
                        Editar
                      </button>
                      <button type="button" className={BUTTON_OUTLINE} onClick={() => onToggle(plan)}>
                        {plan.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button type="button" className={BUTTON_DANGER} onClick={() => onDelete(plan)}>
                        Eliminar
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

export function PlansTab() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<PlanDialog | null>(null);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: PLANS_KEY,
    queryFn: () => apiFetch<PlanDto[]>('/staff/plans', { query: { includeInactive: true } }),
  });

  const onError = (mutationError: unknown) => toast.error(errorMessage(mutationError));
  const refresh = () => queryClient.invalidateQueries({ queryKey: PLANS_KEY });
  const closeDialog = () => setDialog(null);

  const create = useMutation({
    mutationFn: (body: PlanFormPayload) => apiFetch<PlanDto>('/staff/plans', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Plan creado.');
      closeDialog();
      return refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PlanUpdateBody> }) =>
      apiFetch<PlanDto>(`/staff/plans/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Plan actualizado.');
      closeDialog();
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/staff/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Plan eliminado.');
      closeDialog();
      return refresh();
    },
    onError,
  });

  if (isPending) return <Skeleton className="h-80" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button type="button" className={BUTTON_PRIMARY} onClick={() => setDialog({ type: 'create' })}>
          Nuevo plan
        </button>
      </div>
      {data.length === 0 ? (
        <EmptyState title="Sin planes" description="Creá el primer plan para mostrarlo en el sitio." />
      ) : null}
      {SERVICES.map((service) => (
        <ServiceTable
          key={service}
          service={service}
          plans={data.filter((plan) => plan.service === service)}
          onEdit={(plan) => setDialog({ type: 'edit', plan })}
          onToggle={(plan) => update.mutate({ id: plan.id, body: { active: !plan.active } })}
          onDelete={(plan) => setDialog({ type: 'delete', plan })}
        />
      ))}

      <Dialog open={dialog?.type === 'create' || dialog?.type === 'edit'} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialog?.type === 'edit' ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
            <DialogDescription>Los cambios se reflejan de inmediato en el sitio público.</DialogDescription>
          </DialogHeader>
          {dialog?.type === 'create' ? (
            <PlanForm mode="create" submitting={create.isPending} onSubmit={(payload) => create.mutate(payload)} onCancel={closeDialog} />
          ) : null}
          {dialog?.type === 'edit' ? (
            <PlanForm
              mode="edit"
              plan={dialog.plan}
              submitting={update.isPending}
              onSubmit={(payload) => update.mutate({ id: dialog.plan.id, body: updateBody(payload) })}
              onCancel={closeDialog}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.type === 'delete'} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar plan</DialogTitle>
            <DialogDescription>
              {dialog?.type === 'delete'
                ? `¿Seguro que querés eliminar "${dialog.plan.name}"? Dejará de mostrarse en el sitio.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <button type="button" className={BUTTON_OUTLINE} onClick={closeDialog}>
              Cancelar
            </button>
            <button
              type="button"
              className={BUTTON_DANGER}
              disabled={remove.isPending}
              onClick={() => (dialog?.type === 'delete' ? remove.mutate(dialog.plan.id) : undefined)}
            >
              Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
