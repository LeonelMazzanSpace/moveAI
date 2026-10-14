import type { EmailTemplate, TemplateParams } from './index.js';

// Sample data for `pnpm emails:preview`: one entry per template, so a new template cannot be left out.
export const PREVIEW_FIXTURES: { [K in EmailTemplate]: TemplateParams[K] } = {
  'password-reset': { name: 'Ana', url: 'http://localhost:3000/restablecer?token=ejemplo' },
  'account-invitation': { name: 'Ana', url: 'http://localhost:3000/restablecer?token=ejemplo' },
  'booking-confirmed': {
    name: 'Ana', serviceName: 'Rehab', label: 'Evaluación', date: '15/10/2026', time: '09:00', professionalName: 'Pierina Paladini',
  },
  'booking-cancelled': { name: 'Ana', serviceName: 'Performance', date: '15/10/2026', time: '18:00' },
  'purchase-approved': { name: 'Ana', itemName: 'Plan Mensual', amount: 3900, endsOn: '14/11/2026', sessionsTotal: null },
  'plan-expiring': { name: 'Ana', planName: 'Plan Mensual', endsOn: '18/10/2026', renewUrl: 'http://localhost:3000/planes' },
  'plan-expired': { name: 'Ana', planName: 'Plan Mensual', renewUrl: 'http://localhost:3000/planes' },
  'checkin-invite': { name: 'Ana', url: 'http://localhost:3000/check-in' },
  'rehab-referral': { name: 'Ana', url: 'http://localhost:3000/perfil' },
  'booking-cancelled-by-client': { name: 'Ana', serviceName: 'Recovery', date: '15/10/2026', time: '10:00' },
  'booking-not-confirmed': {
    name: 'Ana', serviceName: 'Rehab', date: '15/10/2026', time: '09:00', reason: 'hold_expired', retryUrl: 'http://localhost:3000/reservar',
  },
  'booking-reminder': { name: 'Ana', serviceName: 'Recovery', label: 'Paquete 4 sesiones', date: '15/10/2026', time: '10:00' },
  'staff-rehab-booking': {
    event: 'confirmed', clientName: 'Ana Pérez', label: 'Evaluación', professionalName: 'Pierina Paladini', date: '15/10/2026', time: '09:00',
  },
  'staff-calendar-conflict': { clientName: 'Ana Pérez', professionalName: 'Pierina Paladini', date: '15/10/2026', time: '09:00' },
  'staff-calendar-disconnected': { configUrl: 'http://localhost:3000/staff/configuracion?tab=calendario' },
  'auto-debit-charge-failed': { name: 'Ana', planName: 'Plan Mensual', manageUrl: 'http://localhost:3000/perfil' },
  'auto-debit-cancelled': { name: 'Ana', planName: 'Plan Mensual', paidUntil: '14/11/2026', manageUrl: 'http://localhost:3000/perfil' },
};
