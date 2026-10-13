import { appConfig } from './app.config.js';
import { databaseConfig } from './database.config.js';
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

  describe.each(['PORT', 'DB_PORT'] as const)('%s', (key) => {
    it.each([['1', 1], ['3001', 3001], ['65535', 65535]])('accepts %s', (value, expected) => {
      expect(validate({ ...base, [key]: value })[key]).toBe(expected);
    });

    it.each(['0', '65536', '8e3', '0x1F90', '3001.0', '-1', '+3001', ' 3001', '3001 ', 'abc', '1e2'])('rejects %j', (value) => {
      expect(() => validate({ ...base, [key]: value })).toThrow();
    });

    it('is required', () => {
      const rest: Record<string, string> = { ...base };
      delete rest[key];
      expect(() => validate(rest)).toThrow();
    });
  });

  describe('DB_SSL', () => {
    it.each(['true', 'false'])('accepts %s', (value) => {
      expect(() => validate({ ...base, DB_SSL: value })).not.toThrow();
    });

    it('treats an absent or empty value as missing', () => {
      expect(() => validate(base)).not.toThrow();
      expect(() => validate({ ...base, DB_SSL: '' })).not.toThrow();
    });

    it.each(['1', '0', 'TRUE', 'True', 'yes', ' true'])('rejects %j', (value) => {
      expect(() => validate({ ...base, DB_SSL: value })).toThrow();
    });
  });

  describe('port parsing is shared with the config factories', () => {
    const keys = ['PORT', 'DB_PORT'] as const;
    const original = { PORT: process.env.PORT, DB_PORT: process.env.DB_PORT };
    afterEach(() => {
      for (const key of keys) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });

    it.each(['1', '3001', '65535', '0', '65536', '8e3', '0x1F90', '3001.0', ' 3001', '+3001', 'abc'])(
      'never differs from a validated %j',
      (value) => {
        process.env.PORT = value;
        process.env.DB_PORT = value;
        let validated: { PORT: number; DB_PORT: number };
        try {
          validated = validate({ ...base, PORT: value, DB_PORT: value });
        } catch {
          expect(appConfig().port).toBeNaN();
          expect(databaseConfig().port).toBeNaN();
          return;
        }
        expect(appConfig().port).toBe(validated.PORT);
        expect(databaseConfig().port).toBe(validated.DB_PORT);
      },
    );

    it('keeps the local defaults when the variables are absent', () => {
      delete process.env.PORT;
      delete process.env.DB_PORT;
      expect(appConfig().port).toBe(3001);
      expect(databaseConfig().port).toBe(5432);
    });
  });

  describe('TRUST_PROXY_HOPS', () => {
    it('defaults to 0 when absent or empty', () => {
      expect(validate(base).TRUST_PROXY_HOPS).toBe(0);
      expect(validate({ ...base, TRUST_PROXY_HOPS: '' }).TRUST_PROXY_HOPS).toBe(0);
    });

    it.each([['0', 0], ['2', 2], ['5', 5]])('accepts %s', (value, expected) => {
      expect(validate({ ...base, TRUST_PROXY_HOPS: value }).TRUST_PROXY_HOPS).toBe(expected);
    });

    it.each(['-1', '6', '1.5', 'abc', 'true', '50e-1', '0x2', ' 2', '+2', '2.0'])('rejects %j', (value) => {
      expect(() => validate({ ...base, TRUST_PROXY_HOPS: value })).toThrow();
    });

    describe('appConfig', () => {
      const original = process.env.TRUST_PROXY_HOPS;
      afterEach(() => {
        if (original === undefined) delete process.env.TRUST_PROXY_HOPS;
        else process.env.TRUST_PROXY_HOPS = original;
      });

      it('exposes the validated value', () => {
        process.env.TRUST_PROXY_HOPS = '2';
        expect(appConfig().trustProxyHops).toBe(validate({ ...base, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS);
      });

      it.each(['', '0', '5', '50e-1', '0x2', ' 2', '+2', '2.0'])('never differs from a validated %j', (value) => {
        process.env.TRUST_PROXY_HOPS = value;
        let validated: number;
        try {
          validated = validate({ ...base, TRUST_PROXY_HOPS: value }).TRUST_PROXY_HOPS;
        } catch {
          return;
        }
        expect(appConfig().trustProxyHops).toBe(validated);
      });
    });
  });
});
