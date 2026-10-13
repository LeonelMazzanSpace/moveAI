import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { AuthUser, RequestWithUser, Role } from '../../../common/auth/auth-user.js';
import { IS_PUBLIC_KEY } from '../../../common/auth/public.decorator.js';
import { ROLES_KEY } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { UsersService } from '../../users/services/users.service.js';
import { BETTER_AUTH } from '../auth.constants.js';
import type { BetterAuthInstance } from '../better-auth.factory.js';

// Global guard: resolves the session on every route, then enforces @Public() and @Roles().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets) === true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    const user = await this.resolveUser(req);
    if (user) req.user = user;
    if (isPublic) return true;
    if (!user) throw new AppError('UNAUTHENTICATED');
    if (roles && roles.length > 0 && !roles.includes(user.role)) throw new AppError('FORBIDDEN');
    return true;
  }

  // The role comes from `users` (not the session payload); soft-deleted users count as anonymous.
  private async resolveUser(req: RequestWithUser): Promise<AuthUser | null> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return null;
    const user = await this.usersService.findById(session.user.id);
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
