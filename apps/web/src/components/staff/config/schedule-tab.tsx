'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StatusBadge } from '@/components/move/status-badge';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/components/staff/form-primitives';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { ProfessionalDto, ScheduleTemplateDto, StaffTimeSlotDto } from '@/lib/api/types';
import { SERVICE_LABEL } from '@/lib/format';
import { SERVICES } from './plan-form.schema';
import { TemplateForm, WEEKDAY_SHORT, type SlotBody, type TemplateBody } from './template-form';

const TEMPLATES_KEY = ['staff', 'templates'] as const;
const PROFESSIONALS_KEY = ['staff', 'professionals'] as const;

type ScheduleDialog = 'template' | 'slot';

function sortTemplates(templates: ScheduleTemplateDto[]): ScheduleTemplateDto[] {
  return [...templates].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

function createdMessage(created: number): string {
  return created === 1 ? 'Se creó 1 turno.' : `Se crearon ${created} turnos.`;
}

export function ScheduleTab() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null);
  const templatesQuery = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => apiFetch<ScheduleTemplateDto[]>('/staff/schedule/templates'),
  });
  const professionalsQuery = useQuery({
    queryKey: PROFESSIONALS_KEY,
    queryFn: () => apiFetch<ProfessionalDto[]>('/staff/professionals'),
  });

  const onError = (error: unknown) => toast.error(errorMessage(error));
  const closeDialog = () => setDialog(null);

  const createTemplate = useMutation({
    mutationFn: (body: TemplateBody) => apiFetch<ScheduleTemplateDto>('/staff/schedule/templates', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Horario creado.');
      closeDialog();
      return queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
    onError,
  });
  const toggleTemplate = useMutation({
    mutationFn: (template: ScheduleTemplateDto) =>
      apiFetch<ScheduleTemplateDto>(`/staff/schedule/templates/${template.id}`, { method: 'PATCH', body: { active: !template.active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    onError,
  });
  const createSlot = useMutation({
    mutationFn: (body: SlotBody) => apiFetch<StaffTimeSlotDto>('/staff/time-slots', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Turno creado.');
      closeDialog();
    },
    onError,
  });
  const generate = useMutation({
    mutationFn: () => apiFetch<{ created: number }>('/staff/schedule/generate', { method: 'POST' }),
    onSuccess: ({ created }) => toast.success(createdMessage(created)),
    onError,
  });

  if (templatesQuery.isPending || professionalsQuery.isPending) return <Skeleton className="h-80" />;
  if (templatesQuery.error || !templatesQuery.data) {
    return <ErrorState error={templatesQuery.error} onRetry={() => void templatesQuery.refetch()} />;
  }
  if (professionalsQuery.error || !professionalsQuery.data) {
    return <ErrorState error={professionalsQuery.error} onRetry={() => void professionalsQuery.refetch()} />;
  }

  const templates = sortTemplates(templatesQuery.data);
  const activeProfessionals = professionalsQuery.data.filter((professional) => professional.active);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={BUTTON_OUTLINE} disabled={generate.isPending} onClick={() => generate.mutate()}>
          Generar turnos ahora
        </button>
        <button type="button" className={BUTTON_OUTLINE} onClick={() => setDialog('slot')}>
          Turno puntual
        </button>
        <button type="button" className={BUTTON_PRIMARY} onClick={() => setDialog('template')}>
          Nuevo horario
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState title="Sin horarios" description="Agregá un horario semanal para que se generen los turnos." />
      ) : null}

      {SERVICES.map((service) => {
        const rows = templates.filter((template) => template.service === service);
        if (rows.length === 0) return null;
        return (
          <section key={service} className="space-y-3">
            <h2 className="font-display text-xl font-black uppercase tracking-tight">{SERVICE_LABEL[service]}</h2>
            <div className="rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Cupo</TableHead>
                    <TableHead>Profesional</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((template, index) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {index === 0 || rows[index - 1].weekday !== template.weekday ? WEEKDAY_SHORT[template.weekday - 1] : ''}
                      </TableCell>
                      <TableCell>{template.startTime}</TableCell>
                      <TableCell>{template.durationMinutes} min</TableCell>
                      <TableCell>{template.capacity}</TableCell>
                      <TableCell>{template.professionalName ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadge tone={template.active ? 'success' : 'neutral'}>
                          {template.active ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className={BUTTON_OUTLINE}
                            disabled={toggleTemplate.isPending}
                            onClick={() => toggleTemplate.mutate(template)}
                          >
                            {template.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}

      <Dialog open={dialog === 'template'} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo horario</DialogTitle>
            <DialogDescription>Afecta solo a los turnos que se generen desde ahora.</DialogDescription>
          </DialogHeader>
          <TemplateForm
            mode="template"
            professionals={activeProfessionals}
            submitting={createTemplate.isPending}
            onSubmit={(body) => createTemplate.mutateAsync(body)}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'slot'} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Turno puntual</DialogTitle>
            <DialogDescription>Crea un único turno en una fecha concreta.</DialogDescription>
          </DialogHeader>
          <TemplateForm
            mode="slot"
            professionals={activeProfessionals}
            submitting={createSlot.isPending}
            onSubmit={(body) => createSlot.mutateAsync(body)}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
