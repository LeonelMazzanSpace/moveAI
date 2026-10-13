import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';

export interface BetterAuthDeps {
  pool: Pool;
  secret: string;
  baseURL: string;
  webUrl: string;
  cookieDomain: string | null;
  google: { clientId: string; clientSecret: string } | null;
  isProduction: boolean;
  sendResetPassword: (data: { user: { id: string; email: string; name: string }; url: string; token: string }) => Promise<void>;
}

// The only Better Auth instance of the app. Tables and columns follow the Data contract mapping.
export function createBetterAuth(deps: BetterAuthDeps) {
  return betterAuth({
    database: deps.pool,
    secret: deps.secret,
    baseURL: deps.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [deps.webUrl],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      sendResetPassword: ({ user, url, token }) =>
        deps.sendResetPassword({ user: { id: user.id, email: user.email, name: user.name }, url, token }),
      resetPasswordTokenExpiresIn: 3600,
    },
    socialProviders: deps.google ? { google: deps.google } : {},
    user: {
      modelName: 'users',
      fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'client', input: false, fieldName: 'role' },
        phone: { type: 'string', required: false, input: true, fieldName: 'phone' },
      },
    },
    session: {
      modelName: 'sessions',
      fields: {
        userId: 'user_id', expiresAt: 'expires_at', ipAddress: 'ip_address', userAgent: 'user_agent',
        createdAt: 'created_at', updatedAt: 'updated_at',
      },
    },
    account: {
      modelName: 'accounts',
      fields: {
        userId: 'user_id', accountId: 'account_id', providerId: 'provider_id', accessToken: 'access_token',
        refreshToken: 'refresh_token', idToken: 'id_token', accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at', createdAt: 'created_at', updatedAt: 'updated_at',
      },
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: {
      modelName: 'verifications',
      fields: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' },
    },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: deps.isProduction,
      crossSubDomainCookies: deps.cookieDomain ? { enabled: true, domain: deps.cookieDomain } : undefined,
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
