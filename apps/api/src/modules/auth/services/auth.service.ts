import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { appConfig } from '../../../config/app.config.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { BETTER_AUTH } from '../auth.constants.js';
import type { BetterAuthInstance } from '../better-auth.factory.js';
import { AuthAccount } from '../entities/auth-account.entity.js';

const PG_UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === PG_UNIQUE_VIOLATION;

// Never log or store the reset token itself: only a short hash of it.
const tokenDigest = (token: string): string => createHash('sha256').update(token).digest('hex').slice(0, 16);

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
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async emailExists(email: string): Promise<boolean> {
    return (await this.usersService.findByEmail(email)) !== null;
  }

  // Creates a password-less client (guest checkout, staff "Nuevo cliente") and emails a link to set the password.
  async createInvitedUser(input: { name: string; email: string; phone?: string | null }): Promise<{ userId: string }> {
    const email = input.email.trim().toLowerCase();
    if (await this.emailExists(email)) throw new AppError('EMAIL_ALREADY_REGISTERED');
    const ctx = await this.auth.$context;
    const user = await ctx.internalAdapter
      .createUser({ name: input.name, email, emailVerified: false, role: 'client', phone: input.phone ?? null }, { method: 'admin' })
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
}
