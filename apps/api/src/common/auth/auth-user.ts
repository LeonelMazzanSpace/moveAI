import type { Request } from 'express';

export type Role = 'client' | 'staff';

export interface AuthUser { id: string; email: string; name: string; role: Role }

export interface RequestWithUser extends Request { user?: AuthUser }
