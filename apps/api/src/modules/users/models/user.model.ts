import type { Role } from '../../../common/auth/auth-user.js';

export interface UserModel {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  rehabFollowupEnabled: boolean;
  createdAt: Date;
}

export interface MeDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  rehabFollowupEnabled: boolean;
}
