import { renderEmail, type EmailTemplate, type TemplateParams } from './index.js';
import type { EmailFooter } from './layout.js';
import { PREVIEW_FIXTURES } from './preview-fixtures.js';

describe('renderEmail', () => {
  it('uses the contract subject and escapes params', () => {
    const email = renderEmail('booking-confirmed', {
      name: '<script>x</script>', serviceName: 'Performance', label: 'Entrenamiento semi personalizado', date: '12/10/2026', time: '18:00',
    });
    expect(email.subject).toBe('Tu reserva en MOVE está confirmada');
    expect(email.html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(email.html).not.toContain('<script>x');
    expect(email.text).toContain('12/10/2026');
  });

  it('renders every template', () => {
    expect(renderEmail('account-invitation', { name: 'Ana', url: 'https://x/restablecer' }).html).toContain('https://x/restablecer');
    expect(renderEmail('plan-expiring', { name: 'Ana', planName: 'Plan Mensual', endsOn: '18/10/2026', renewUrl: 'https://x/planes' }).subject)
      .toBe('Tu plan de MOVE vence pronto');
  });
});

const XSS = '<script>x</script>';

const CASES: { [K in EmailTemplate]: { subject: string; params: TemplateParams[K] } } = {
  'password-reset': { subject: 'Restablecé tu contraseña de MOVE', params: { name: XSS, url: `https://x/?a=${XSS}` } },
  'account-invitation': { subject: 'Activá tu cuenta de MOVE', params: { name: XSS, url: `https://x/?a=${XSS}` } },
  'booking-confirmed': {
    subject: 'Tu reserva en MOVE está confirmada',
    params: { name: XSS, serviceName: XSS, label: XSS, date: XSS, time: XSS },
  },
  'booking-cancelled': {
    subject: 'Tu reserva en MOVE fue cancelada',
    params: { name: XSS, serviceName: XSS, date: XSS, time: XSS },
  },
  'purchase-approved': {
    subject: 'Recibimos tu pago',
    params: { name: XSS, itemName: XSS, amount: 3900, endsOn: XSS, sessionsTotal: 4 },
  },
  'plan-expiring': {
    subject: 'Tu plan de MOVE vence pronto',
    params: { name: XSS, planName: XSS, endsOn: XSS, renewUrl: `https://x/?a=${XSS}` },
  },
  'plan-expired': { subject: 'Tu plan de MOVE venció', params: { name: XSS, planName: XSS, renewUrl: `https://x/?a=${XSS}` } },
  'checkin-invite': { subject: '¿Cómo venís? Contanos en 1 minuto', params: { name: XSS, url: `https://x/?a=${XSS}` } },
  'rehab-referral': {
    subject: 'Te habilitamos el seguimiento fisioterapéutico',
    params: { name: XSS, url: `https://x/?a=${XSS}` },
  },
  'booking-cancelled-by-client': {
    subject: 'Cancelaste tu reserva en MOVE',
    params: { name: XSS, serviceName: XSS, date: XSS, time: XSS },
  },
  'booking-not-confirmed': {
    subject: 'Tu reserva en MOVE no se confirmó',
    params: { name: XSS, serviceName: XSS, date: XSS, time: XSS, reason: 'payment_rejected', retryUrl: `https://x/?a=${XSS}` },
  },
  'booking-reminder': {
    subject: 'Te esperamos mañana en MOVE',
    params: { name: XSS, serviceName: XSS, label: XSS, date: XSS, time: XSS },
  },
  'staff-rehab-booking': {
    subject: `Rehab: reserva confirmada · ${XSS} ${XSS}`,
    params: { event: 'confirmed', clientName: XSS, label: XSS, professionalName: XSS, date: XSS, time: XSS },
  },
  'staff-calendar-conflict': {
    subject: `Conflicto en Google Calendar · ${XSS} ${XSS}`,
    params: { clientName: XSS, professionalName: XSS, date: XSS, time: XSS },
  },
  'staff-calendar-disconnected': {
    subject: 'Google Calendar se desconectó de MOVE',
    params: { configUrl: `https://x/?a=${XSS}` },
  },
  'auto-debit-charge-failed': {
    subject: 'No pudimos cobrar tu plan de MOVE',
    params: { name: XSS, planName: XSS, manageUrl: `https://x/?a=${XSS}` },
  },
  'auto-debit-cancelled': {
    subject: 'Tu débito automático en MOVE fue cancelado',
    params: { name: XSS, planName: XSS, paidUntil: XSS, manageUrl: `https://x/?a=${XSS}` },
  },
};

describe('renderEmail contract', () => {
  it.each(Object.keys(CASES) as EmailTemplate[])('%s has the contract subject and escapes <script>', (template) => {
    const { subject, params } = CASES[template];
    const email = renderEmail(template, params as never);
    expect(email.subject).toBe(subject);
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<script');
  });

  it('formats the purchase amount in pesos', () => {
    const email = renderEmail('purchase-approved', { name: 'Ana', itemName: 'Plan Mensual', amount: 3900, endsOn: null, sessionsTotal: null });
    expect(email.text).toContain('$ 3.900');
  });
});

describe('new templates', () => {
  it('booking-not-confirmed explains each reason and links to book again', () => {
    const base = { name: 'Ana', serviceName: 'Rehab', date: '15/10/2026', time: '09:00', retryUrl: 'https://x/reservar' };
    const rejected = renderEmail('booking-not-confirmed', { ...base, reason: 'payment_rejected' });
    const expired = renderEmail('booking-not-confirmed', { ...base, reason: 'hold_expired' });
    expect(rejected.text).toContain('No pudimos confirmar el pago');
    expect(expired.text).toContain('Pasó el tiempo para completar el pago');
    expect(rejected.html).toContain('href="https://x/reservar"');
  });

  it('staff-rehab-booking switches the subject and title with the event', () => {
    const base = { clientName: 'Ana', label: 'Evaluación', professionalName: 'Pierina', date: '15/10/2026', time: '09:00' };
    const confirmed = renderEmail('staff-rehab-booking', { ...base, event: 'confirmed' });
    const cancelled = renderEmail('staff-rehab-booking', { ...base, event: 'cancelled' });
    expect(confirmed.subject).toBe('Rehab: reserva confirmada · 15/10/2026 09:00');
    expect(cancelled.subject).toBe('Rehab: reserva cancelada · 15/10/2026 09:00');
    expect(confirmed.text).toContain('Profesional: Pierina');
    expect(renderEmail('staff-rehab-booking', { ...base, event: 'confirmed', professionalName: null }).text).not.toContain('Profesional');
  });

  it('auto-debit-cancelled mentions the paid-until date only when there is one', () => {
    const base = { name: 'Ana', planName: 'Plan Mensual', manageUrl: 'https://x/perfil' };
    expect(renderEmail('auto-debit-cancelled', { ...base, paidUntil: '30/11/2026' }).text).toContain('hasta el 30/11/2026');
    expect(renderEmail('auto-debit-cancelled', { ...base, paidUntil: null }).text).not.toContain('hasta el');
  });

  it('staff-calendar-disconnected links to the calendar settings', () => {
    expect(renderEmail('staff-calendar-disconnected', { configUrl: 'https://x/staff/configuracion?tab=calendario' }).html)
      .toContain('href="https://x/staff/configuracion?tab=calendario"');
  });

  it('booking-confirmed adds the professional only when given', () => {
    const base = { name: 'Ana', serviceName: 'Rehab', label: 'Evaluación', date: '15/10/2026', time: '09:00' };
    expect(renderEmail('booking-confirmed', { ...base, professionalName: 'Pierina' }).text).toContain('Profesional: Pierina');
    expect(renderEmail('booking-confirmed', base).text).not.toContain('Profesional');
  });

  it('booking-cancelled points to the footer channels instead of a generic contact line', () => {
    const email = renderEmail('booking-cancelled', { name: 'Ana', serviceName: 'Performance', date: '15/10/2026', time: '18:00' });
    expect(email.text).toContain('Si tenés dudas, escribinos por los canales de abajo.');
    expect(email.text).not.toContain('contactá a MOVE');
  });
});

describe('email footer', () => {
  const params = { name: 'Ana', url: 'https://x/check-in' };
  const FULL: EmailFooter = {
    address: 'Máximo Tajes 6397 esquina Beranger',
    hours: 'Lunes a viernes · 7:00 – 11:00',
    whatsapp: '+598 99 140 299',
    instagram: '@move_strengthconditioning',
    email: 'hola@move.test',
  };

  it('shows every filled field in html and text, ending with MOVE in the text', () => {
    const email = renderEmail('checkin-invite', params, FULL);
    for (const line of [
      'Máximo Tajes 6397 esquina Beranger', 'Lunes a viernes · 7:00 – 11:00', 'WhatsApp +598 99 140 299',
      'Instagram @move_strengthconditioning', 'hola@move.test',
    ]) {
      expect(email.html).toContain(line);
      expect(email.text).toContain(line);
    }
    expect(email.html).toContain('border-top');
    expect(email.text.endsWith('\n\nMOVE')).toBe(true);
    expect(email.text.indexOf('hola@move.test')).toBeGreaterThan(email.text.indexOf('https://x/check-in'));
  });

  it('omits empty fields', () => {
    const email = renderEmail('checkin-invite', params, { ...FULL, email: '', instagram: '', hours: '' });
    expect(email.text).not.toContain('Instagram');
    expect(email.text).not.toContain('hola@move.test');
    expect(email.text).not.toContain('Lunes');
    expect(email.html).not.toContain('Instagram');
    expect(email.text).toContain('WhatsApp +598 99 140 299');
  });

  it('adds no footer block when every field is empty or the footer is undefined', () => {
    const empty = { address: '', hours: '', whatsapp: '', instagram: '', email: '' };
    for (const footer of [undefined, empty]) {
      const email = renderEmail('checkin-invite', params, footer);
      expect(email.html).not.toContain('border-top');
      expect(email.text).not.toContain('--');
      expect(email.text.endsWith('\n\nMOVE')).toBe(true);
    }
  });

  it('escapes the footer values', () => {
    const email = renderEmail('checkin-invite', params, { ...FULL, address: '<script>x</script>' });
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<script');
  });
});

describe('preview fixtures', () => {
  it.each(Object.keys(PREVIEW_FIXTURES) as EmailTemplate[])('%s renders with its fixture', (template) => {
    const email = renderEmail(template, PREVIEW_FIXTURES[template] as never);
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html).toContain('<!DOCTYPE html>');
  });

  it('covers all 17 templates', () => {
    expect(Object.keys(PREVIEW_FIXTURES)).toHaveLength(17);
  });
});
