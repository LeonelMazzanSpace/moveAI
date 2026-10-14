import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { Pool } from 'pg';
import { isWellFormedString } from '../../common/validation/well-formed.js';
import { cleanText, EMAIL_LENGTH, NAME_LENGTH, PHONE_LENGTH } from '../users/dto/update-me.dto.js';

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

const logger = new Logger('BetterAuth');
const USER_AGENT_LENGTH = 512;

// Better Auth stores sign-up fields as sent: apply the PATCH /me rules (trim, bounds, no NUL) and reject unpaired surrogates before it writes the user.
// `image` is never accepted here: the web does not send it and Google's image arrives through the OAuth callback.
const validateSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/sign-up/email') return;
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const name = cleanText(body.name, NAME_LENGTH);
  const email = cleanText(body.email, EMAIL_LENGTH);
  const hasPhone = body.phone !== undefined && body.phone !== null;
  const phone = hasPhone ? cleanText(body.phone, PHONE_LENGTH) : null;
  const hasImage = body.image !== undefined && body.image !== null;
  const wellFormed = [name, email, phone].every((value) => value === null || isWellFormedString(value));
  if (name === null || email === null || (hasPhone && phone === null) || hasImage || !wellFormed) {
    throw new APIError('BAD_REQUEST', { code: 'VALIDATION_FAILED', message: 'Los datos enviados no son válidos.' });
  }
  return { context: { body: { ...body, name, email, ...(phone === null ? {} : { phone }) } } };
});

// The only Better Auth instance of the app. Tables and columns follow the Data contract mapping.
export function createBetterAuth(deps: BetterAuthDeps) {
  return betterAuth({
    database: deps.pool,
    secret: deps.secret,
    baseURL: deps.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [deps.webUrl],
    // Profile edits go through PATCH /api/me, which validates them.
    disabledPaths: ['/update-user'],
    hooks: { before: validateSignUp },
    databaseHooks: {
      session: {
        create: {
          // The User-Agent header is client-controlled: cap what is stored in sessions.user_agent.
          before: async (session) => ({
            data: { ...session, userAgent: session.userAgent?.slice(0, USER_AGENT_LENGTH) ?? null },
          }),
        },
      },
    },
    // Forward only the message: Better Auth passes raw errors (e.g. pg details with emails) as extra arguments.
    logger: {
      log: (level, message) => {
        if (level === 'error') logger.error(message);
        else if (level === 'warn') logger.warn(message);
        else if (level === 'info') logger.log(message);
        else logger.debug(message);
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      sendResetPassword: ({ user, url, token }) =>
        deps.sendResetPassword({ user: { id: user.id, email: user.email, name: user.name }, url, token }),
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      // D40: completing a reset or invitation link proves inbox ownership, so Google can link to the account afterwards.
      onPasswordReset: async ({ user }) => {
        await deps.pool.query('UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1', [user.id]);
      },
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
      // Better Auth skips origin, callback and redirect checks under test by default; keep them on everywhere.
      disableOriginCheck: false,
      useSecureCookies: deps.isProduction,
      crossSubDomainCookies: deps.cookieDomain ? { enabled: true, domain: deps.cookieDomain } : undefined,
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
