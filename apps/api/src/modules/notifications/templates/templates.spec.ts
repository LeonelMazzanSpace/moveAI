import { renderEmail, type EmailTemplate, type TemplateParams } from './index.js';

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
