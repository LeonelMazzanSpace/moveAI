import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { appConfig } from '../../../config/app.config.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { cleanText, EMAIL_LENGTH, NAME_LENGTH, PHONE_LENGTH } from '../../users/dto/update-me.dto.js';
import { BETTER_AUTH } from '../auth.constants.js';
import type { BetterAuthInstance } from '../better-auth.factory.js';
import { AuthAccount } from '../entities/auth-account.entity.js';
import { AuthSession } from '../entities/auth-session.entity.js';

const PG_UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === PG_UNIQUE_VIOLATION;

// Never log or store the reset token itself: only a short hash of it.
const tokenDigest = (token: string): string => createHash('sha256').update(token).digest('hex').slice(0, 16);

// Trimmed, lowercased email without NUL bytes; anything else is a validation error.
const normalizeEmail = (email: string): string => {
  const clean = cleanText(email, EMAIL_LENGTH);
  if (clean === null) throw new AppError('VALIDATION_FAILED');
  return clean.toLowerCase();
};

export interface PasswordEmailData {
  user: { id: string; email: string; name: string };
  url: string;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
    @InjectRepository(AuthAccount) private readonly accounts: Repository<AuthAccount>,
    private readonly notifications: NotificationsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Includes soft-deleted users, like the UNIQUE email and Better Auth's own sign-up check:
  // `true` means no new account can be created with this email (case-insensitive).
  async emailExists(email: string): Promise<boolean> {
    const ctx = await this.auth.$context;
    return (await ctx.internalAdapter.findUserByEmail(normalizeEmail(email))) !== null;
  }

  // Creates a password-less client (guest checkout, staff "Nuevo cliente") and emails a link to set the password.
  async createInvitedUser(input: { name: string; email: string; phone?: string | null }): Promise<{ userId: string }> {
    const email = normalizeEmail(input.email);
    if (await this.emailExists(email)) throw new AppError('EMAIL_ALREADY_REGISTERED');
    const name = cleanText(input.name, NAME_LENGTH);
    const hasPhone = input.phone !== undefined && input.phone !== null;
    const phone = hasPhone ? cleanText(input.phone, PHONE_LENGTH) : null;
    if (name === null || (hasPhone && phone === null)) throw new AppError('VALIDATION_FAILED');
    const ctx = await this.auth.$context;
    const user = await ctx.internalAdapter
      .createUser({ name, email, emailVerified: false, role: 'client', phone }, { method: 'admin' })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new AppError('EMAIL_ALREADY_REGISTERED');
        throw error;
      });
    await this.auth.api.requestPasswordReset({ body: { email, redirectTo: `${this.app.webUrl}/restablecer` } });
    return { userId: user.id };
  }

  // Better Auth `sendResetPassword`: users with a password get `password-reset`, invited users `account-invitation`.
  async sendPasswordEmail({ user, url, token }: PasswordEmailData): Promise<void> {
    const hasPassword = await this.accounts.existsBy({ userId: user.id, providerId: 'credential' });
    const template = hasPassword ? 'password-reset' : 'account-invitation';
    await this.notifications.send({
      template,
      to: { email: user.email, name: user.name },
      userId: user.id,
      idempotencyKey: `${template}:${tokenDigest(token)}`,
      params: { name: user.name, url },
    });
  }

  // D54, only for `user:create-staff --promote-existing`: makes an existing account staff in one transaction.
  // Sets the given password on its credential account (creating it if missing), revokes every session and marks
  // the email verified, so whoever registered the address first keeps no access.
  async promoteExistingToStaff(userId: string, password: string): Promise<void> {
    const ctx = await this.auth.$context;
    const { minPasswordLength, maxPasswordLength } = ctx.password.config;
    if (password.length < minPasswordLength || password.length > maxPasswordLength) {
      throw new AppError('VALIDATION_FAILED');
    }
    const hash = await ctx.password.hash(password);
    await this.dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository(AuthAccount);
      const credential = await accounts.findOneBy({ userId, providerId: 'credential' });
      if (credential) await accounts.update({ id: credential.id }, { password: hash });
      else await accounts.insert({ userId, providerId: 'credential', accountId: userId, password: hash });
      await manager.delete(AuthSession, { userId });
      await manager.query(
        `UPDATE users SET role = 'staff', email_verified = true, updated_at = now() WHERE id = $1`,
        [userId],
      );
    });
  }
}
