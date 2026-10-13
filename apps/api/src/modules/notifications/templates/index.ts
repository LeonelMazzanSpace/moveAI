import { wrapHtml, wrapText, type EmailLayoutInput } from './layout.js';

export type EmailTemplate =
  | 'password-reset' | 'account-invitation' | 'booking-confirmed' | 'booking-cancelled'
  | 'purchase-approved' | 'plan-expiring' | 'plan-expired' | 'checkin-invite' | 'rehab-referral';

export interface TemplateParams {
  'password-reset': { name: string; url: string };
  'account-invitation': { name: string; url: string };
  'booking-confirmed': { name: string; serviceName: string; label: string; date: string; time: string };
  'booking-cancelled': { name: string; serviceName: string; date: string; time: string };
  'purchase-approved': { name: string; itemName: string; amount: number; endsOn: string | null; sessionsTotal: number | null };
  'plan-expiring': { name: string; planName: string; endsOn: string; renewUrl: string };
  'plan-expired': { name: string; planName: string; renewUrl: string };
  'checkin-invite': { name: string; url: string };
  'rehab-referral': { name: string; url: string };
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
          `Te esperamos el ${input.params.date} a las ${input.params.time}.`,
        ],
      };
    case 'booking-cancelled':
      return {
        subject: 'Tu reserva en MOVE fue cancelada',
        title: 'Reserva cancelada',
        paragraphs: [
          `Hola ${input.params.name}, cancelamos tu reserva de ${input.params.serviceName} del ${input.params.date} a las ${input.params.time}.`,
          'Si tenés dudas, contactá a MOVE.',
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
    default: {
      const unreachable: never = input;
      return unreachable;
    }
  }
};

export const renderEmail = <K extends EmailTemplate>(template: K, params: TemplateParams[K]): RenderedEmail => {
  const { subject, ...layout } = buildContent({ template, params } as RenderInput);
  return { subject, html: wrapHtml(layout), text: wrapText(layout) };
};
