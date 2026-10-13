import { validate } from './env.validation.js';

const base = {
  NODE_ENV: 'development', PORT: '3001', WEB_URL: 'http://localhost:3000', API_PUBLIC_URL: 'http://localhost:3001',
  DB_HOST: 'localhost', DB_PORT: '5432', DB_USER: 'move', DB_PASSWORD: 'move', DB_NAME: 'move',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
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
    expect(() =>
      validate({
        ...base, NODE_ENV: 'production', MP_ACCESS_TOKEN: 'APP_USR-1', MP_WEBHOOK_SECRET: 'whsec',
        BREVO_API_KEY: 'xkeysib-1', BREVO_SENDER_EMAIL: 'hola@example.com',
      }),
    ).not.toThrow();
  });

  it('requires google id and secret together', () => {
    expect(() => validate({ ...base, GOOGLE_CLIENT_ID: 'id' })).toThrow();
    expect(() => validate({ ...base, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).not.toThrow();
  });

  it('treats empty values as missing', () => {
    expect(() => validate({ ...base, MP_ACCESS_TOKEN: '' })).not.toThrow();
  });
});
