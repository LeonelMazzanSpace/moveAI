import { wrapHtml, wrapText, type EmailFooter, type EmailLayoutInput } from './layout.js';

export type EmailTemplate =
  | 'password-reset' | 'account-invitation' | 'booking-confirmed' | 'booking-cancelled'
  | 'purchase-approved' | 'plan-expiring' | 'plan-expired' | 'checkin-invite' | 'rehab-referral'
  | 'booking-cancelled-by-client' | 'booking-not-confirmed' | 'booking-reminder' | 'staff-rehab-booking'
  | 'staff-calendar-conflict' | 'staff-calendar-disconnected' | 'auto-debit-charge-failed' | 'auto-debit-cancelled';

export interface TemplateParams {
  'password-reset': { name: string; url: string };
  'account-invitation': { name: string; url: string };
  'booking-confirmed': { name: string; serviceName: string; label: string; date: string; time: string; professionalName?: string };
  'booking-cancelled': { name: string; serviceName: string; date: string; time: string };
  'purchase-approved': { name: string; itemName: string; amount: number; endsOn: string | null; sessionsTotal: number | null };
  'plan-expiring': { name: string; planName: string; endsOn: string; renewUrl: string };
  'plan-expired': { name: string; planName: string; renewUrl: string };
  'checkin-invite': { name: string; url: string };
  'rehab-referral': { name: string; url: string };
  'booking-cancelled-by-client': { name: string; serviceName: string; date: string; time: string };
  'booking-not-confirmed': {
    name: string; serviceName: string; date: string; time: string; reason: 'payment_rejected' | 'hold_expired'; retryUrl: string;
  };
  'booking-reminder': { name: string; serviceName: string; label: string; date: string; time: string };
  'staff-rehab-booking': {
    event: 'confirmed' | 'cancelled'; clientName: string; label: string; professionalName: string | null; date: string; time: string;
  };
  'staff-calendar-conflict': { clientName: string; professionalName: string | null; date: string; time: string };
  'staff-calendar-disconnected': { configUrl: string };
  'auto-debit-charge-failed': { name: string; planName: string; manageUrl: string };
  'auto-debit-cancelled': { name: string; planName: string; paidUntil: string | null; manageUrl: string };
}

export interface SendEmailInput<K extends EmailTemplate = EmailTemplate> {
  template: K;
  to: { email: string; name: string };
  userId: string | null;
  idempotencyKey: string;
  params: TemplateParams[K];
}

export type SendResult = 'sent' | 'skipped' | 'failed' | 'duplicate';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type RenderInput = { [K in EmailTemplate]: { template: K; params: TemplateParams[K] } }[EmailTemplate];

interface EmailContent extends EmailLayoutInput {
  subject: string;
}

const formatAmount = (amount: number): string => `$ ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const buildContent = (input: RenderInput): EmailContent => {
  switch (input.template) {
    case 'password-reset':
      return {
        subject: 'Restablecé tu contraseña de MOVE',
        title: 'Restablecé tu contraseña',
        paragraphs: [
          `Hola ${input.params.name}, recibimos un pedido para restablecer tu contraseña.`,
          'Si no fuiste vos, ignorá este mensaje: tu cuenta sigue segura.',
        ],
        cta: { label: 'Elegir nueva contraseña', url: input.params.url },
      };
    case 'account-invitation':
      return {
        subject: 'Activá tu cuenta de MOVE',
        title: 'Activá tu cuenta',
        paragraphs: [
          `Hola ${input.params.name}, MOVE creó una cuenta para vos.`,
          'Definí tu contraseña para empezar a reservar tus turnos.',
        ],
        cta: { label: 'Definir contraseña', url: input.params.url },
      };
    case 'booking-confirmed':
      return {
        subject: 'Tu reserva en MOVE está confirmada',
        title: 'Reserva confirmada',
        paragraphs: [
          `Hola ${input.params.name}, tu reserva quedó confirmada.`,
          `${input.params.serviceName} · ${input.params.label}`,
          ...(input.params.professionalName ? [`Profesional: ${input.params.professionalName}`] : []),
          `Te esperamos el ${input.params.date} a las ${input.params.time}.`,
        ],
      };
    case 'booking-cancelled':
      return {
        subject: 'Tu reserva en MOVE fue cancelada',
        title: 'Reserva cancelada',
        paragraphs: [
          `Hola ${input.params.name}, cancelamos tu reserva de ${input.params.serviceName} del ${input.params.date} a las ${input.params.time}.`,
          'Si tenés dudas, escribinos por los canales de abajo.',
        ],
      };
    case 'purchase-approved':
      return {
        subject: 'Recibimos tu pago',
        title: 'Recibimos tu pago',
        paragraphs: [
          `Hola ${input.params.name}, recibimos tu pago de ${formatAmount(input.params.amount)} por ${input.params.itemName}.`,
          ...(input.params.endsOn ? [`Tu plan está vigente hasta el ${input.params.endsOn}.`] : []),
          ...(input.params.sessionsTotal ? [`Incluye ${input.params.sessionsTotal} sesiones para reservar.`] : []),
        ],
      };
    case 'plan-expiring':
      return {
        subject: 'Tu plan de MOVE vence pronto',
        title: 'Tu plan vence pronto',
        paragraphs: [
          `Hola ${input.params.name}, tu ${input.params.planName} vence el ${input.params.endsOn}.`,
          'Si lo renovás antes de esa fecha, seguís entrenando sin cortes.',
        ],
        cta: { label: 'Renovar plan', url: input.params.renewUrl },
      };
    case 'plan-expired':
      return {
        subject: 'Tu plan de MOVE venció',
        title: 'Tu plan venció',
        paragraphs: [
          `Hola ${input.params.name}, tu ${input.params.planName} venció.`,
          'Cuando quieras volver, renovalo y reservá tus turnos de nuevo.',
        ],
        cta: { label: 'Renovar plan', url: input.params.renewUrl },
      };
    case 'checkin-invite':
      return {
        subject: '¿Cómo venís? Contanos en 1 minuto',
        title: '¿Cómo venís?',
        paragraphs: [
          `Hola ${input.params.name}, queremos saber cómo te sentís con tu entrenamiento.`,
          'Son unas pocas preguntas y nos ayudan a acompañarte mejor.',
        ],
        cta: { label: 'Completar check-in', url: input.params.url },
      };
    case 'rehab-referral':
      return {
        subject: 'Te habilitamos el seguimiento fisioterapéutico',
        title: 'Seguimiento fisioterapéutico',
        paragraphs: [
          `Hola ${input.params.name}, te habilitamos el seguimiento fisioterapéutico.`,
          'Ya podés reservar tus turnos de Rehab desde tu perfil.',
        ],
        cta: { label: 'Reservar turno', url: input.params.url },
      };
    case 'booking-cancelled-by-client':
      return {
        subject: 'Cancelaste tu reserva en MOVE',
        title: 'Reserva cancelada',
        paragraphs: [
          `Hola ${input.params.name}, cancelamos tu reserva de ${input.params.serviceName} del ${input.params.date} a las ${input.params.time}, como pediste.`,
          'El lugar quedó libre. Cuando quieras, podés reservar otro turno desde tu perfil.',
        ],
      };
    case 'booking-not-confirmed':
      return {
        subject: 'Tu reserva en MOVE no se confirmó',
        title: 'Tu reserva no se confirmó',
        paragraphs: [
          `Hola ${input.params.name}, tu reserva de ${input.params.serviceName} del ${input.params.date} a las ${input.params.time} no se confirmó.`,
          input.params.reason === 'payment_rejected'
            ? 'No pudimos confirmar el pago, así que liberamos el lugar.'
            : 'Pasó el tiempo para completar el pago, así que liberamos el lugar.',
          'Si todavía querés ese horario u otro, podés reservar de nuevo.',
        ],
        cta: { label: 'Reservar de nuevo', url: input.params.retryUrl },
      };
    case 'booking-reminder':
      return {
        subject: 'Te esperamos mañana en MOVE',
        title: 'Te esperamos mañana',
        paragraphs: [
          `Hola ${input.params.name}, te recordamos tu turno de mañana.`,
          `${input.params.serviceName} · ${input.params.label}`,
          `${input.params.date} a las ${input.params.time}.`,
          'Si no podés venir, escribinos por los canales de abajo.',
        ],
      };
    case 'staff-rehab-booking': {
      const confirmed = input.params.event === 'confirmed';
      return {
        subject: `Rehab: reserva ${confirmed ? 'confirmada' : 'cancelada'} · ${input.params.date} ${input.params.time}`,
        title: confirmed ? 'Nueva reserva de Rehab' : 'Reserva de Rehab cancelada',
        paragraphs: [
          `${input.params.clientName} · ${input.params.label}`,
          `${input.params.date} a las ${input.params.time}.`,
          ...(input.params.professionalName ? [`Profesional: ${input.params.professionalName}`] : []),
        ],
      };
    }
    case 'staff-calendar-conflict':
      return {
        subject: `Conflicto en Google Calendar · ${input.params.date} ${input.params.time}`,
        title: 'Conflicto en Google Calendar',
        paragraphs: [
          `El turno de Rehab del ${input.params.date} a las ${input.params.time} quedó ocupado en Google Calendar, pero ${input.params.clientName} ya tiene una reserva en ese horario.`,
          ...(input.params.professionalName ? [`Profesional: ${input.params.professionalName}`] : []),
          'La reserva sigue activa. Revisá el turno y coordiná con el cliente si hace falta.',
        ],
      };
    case 'staff-calendar-disconnected':
      return {
        subject: 'Google Calendar se desconectó de MOVE',
        title: 'Google Calendar se desconectó',
        paragraphs: [
          'MOVE perdió el acceso a Google Calendar: el permiso se revocó o la autorización venció.',
          'Mientras tanto no se sincronizan los turnos de Rehab y todos quedan libres para reservar. Reconectá la cuenta para retomar la sincronización.',
        ],
        cta: { label: 'Reconectar Google Calendar', url: input.params.configUrl },
      };
    case 'auto-debit-charge-failed':
      return {
        subject: 'No pudimos cobrar tu plan de MOVE',
        title: 'No pudimos cobrar tu plan',
        paragraphs: [
          `Hola ${input.params.name}, no pudimos cobrar el débito automático de tu ${input.params.planName}.`,
          'Mercado Pago va a reintentar el cobro. Mientras tanto, revisá el medio de pago asociado.',
        ],
        cta: { label: 'Ver mi débito automático', url: input.params.manageUrl },
      };
    case 'auto-debit-cancelled':
      return {
        subject: 'Tu débito automático en MOVE fue cancelado',
        title: 'Cancelamos tu débito automático',
        paragraphs: [
          `Hola ${input.params.name}, el débito automático de tu ${input.params.planName} fue cancelado.`,
          input.params.paidUntil
            ? `Lo que ya pagaste sigue vigente hasta el ${input.params.paidUntil}.`
            : 'Lo que ya pagaste sigue vigente.',
          'Si querés seguir con débito automático, podés volver a contratarlo desde tu perfil.',
        ],
        cta: { label: 'Ir a mi perfil', url: input.params.manageUrl },
      };
    default: {
      const unreachable: never = input;
      return unreachable;
    }
  }
};

export const renderEmail = <K extends EmailTemplate>(
  template: K,
  params: TemplateParams[K],
  footer?: EmailFooter,
): RenderedEmail => {
  const { subject, ...layout } = buildContent({ template, params } as RenderInput);
  return { subject, html: wrapHtml(layout, footer), text: wrapText(layout, footer) };
};
