import { validate } from './env.validation.js';

const base = {
  NODE_ENV: 'development', PORT: '3001', WEB_URL: 'http://localhost:3000', API_PUBLIC_URL: 'http://localhost:3001',
  DB_HOST: 'localhost', DB_PORT: '5432', DB_USER: 'move', DB_PASSWORD: 'move', DB_NAME: 'move',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

const prodFull = {
  ...base, NODE_ENV: 'production', MP_ACCESS_TOKEN: 'APP_USR-1', MP_WEBHOOK_SECRET: 'whsec',
  BREVO_API_KEY: 'xkeysib-1', BREVO_SENDER_EMAIL: 'hola@example.com',
};

describe('env validation', () => {
  it('accepts a minimal development env', () => {
    expect(() => validate(base)).not.toThrow();
  });

  it('requires a 32+ char auth secret', () => {
    expect(() => validate({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow();
    expect(() => validate({ ...base, BETTER_AUTH_SECRET: '' })).toThrow();
  });

  it('requires provider credentials in production', () => {
    expect(() => validate({ ...base, NODE_ENV: 'production' })).toThrow();
    expect(() => validate(prodFull)).not.toThrow();
  });

  it.each(['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL'])(
    'rejects an empty %s in production',
    (key) => {
      expect(() => validate({ ...prodFull, [key]: '' })).toThrow();
    },
  );

  it('requires google id and secret together', () => {
    expect(() => validate({ ...base, GOOGLE_CLIENT_ID: 'id' })).toThrow();
    expect(() => validate({ ...base, GOOGLE_CLIENT_SECRET: 'secret' })).toThrow();
    expect(() => validate({ ...base, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).not.toThrow();
  });

  it('treats empty values as missing', () => {
    expect(() => validate({ ...base, MP_ACCESS_TOKEN: '' })).not.toThrow();
  });

  it('accepts only true or false for SCHEDULER_ENABLED', () => {
    expect(() => validate({ ...base, SCHEDULER_ENABLED: 'false' })).not.toThrow();
    expect(() => validate({ ...base, SCHEDULER_ENABLED: 'true' })).not.toThrow();
    expect(() => validate({ ...base, SCHEDULER_ENABLED: '0' })).toThrow();
  });

  describe('TRUST_PROXY_HOPS', () => {
    it('defaults to 0 when absent or empty', () => {
      expect(validate(base).TRUST_PROXY_HOPS).toBe(0);
      expect(validate({ ...base, TRUST_PROXY_HOPS: '' }).TRUST_PROXY_HOPS).toBe(0);
    });

    it.each([['0', 0], ['2', 2], ['5', 5]])('accepts %s', (value, expected) => {
      expect(validate({ ...base, TRUST_PROXY_HOPS: value }).TRUST_PROXY_HOPS).toBe(expected);
    });

    it.each(['-1', '6', '1.5', 'abc', 'true'])('rejects %s', (value) => {
      expect(() => validate({ ...base, TRUST_PROXY_HOPS: value })).toThrow();
    });
  });
});
