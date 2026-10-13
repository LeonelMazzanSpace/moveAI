import { renderEmail } from './index.js';

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
