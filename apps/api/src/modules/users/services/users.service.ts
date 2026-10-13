import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { User } from '../entities/user.entity.js';
import type { MeDto, UserModel } from '../models/user.model.js';

const toModel = (user: User): UserModel => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  rehabFollowupEnabled: user.rehabFollowupEnabled,
  createdAt: user.createdAt,
});

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findById(id: string): Promise<UserModel | null> {
    const user = await this.users.findOneBy({ id });
    return user ? toModel(user) : null;
  }

  async findByIds(ids: string[]): Promise<UserModel[]> {
    if (ids.length === 0) return [];
    const users = await this.users.findBy({ id: In(ids) });
    return users.map(toModel);
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    const user = await this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
    return user ? toModel(user) : null;
  }

  // Includes soft-deleted accounts, whose email stays taken: `deleted` tells them apart.
  async findByEmailWithDeleted(email: string): Promise<{ user: UserModel; deleted: boolean } | null> {
    const user = await this.users
      .createQueryBuilder('user')
      .withDeleted()
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
    return user ? { user: toModel(user), deleted: user.deletedAt !== null } : null;
  }

  // D54: staff role plus a verified email, inside the caller's transaction.
  async promoteToStaff(manager: EntityManager, userId: string): Promise<void> {
    await manager.getRepository(User).update({ id: userId }, { role: 'staff', emailVerified: true });
  }

  async listClients(): Promise<UserModel[]> {
    const users = await this.users.find({ where: { role: 'client' }, order: { name: 'ASC' } });
    return users.map(toModel);
  }

  async updateProfile(id: string, patch: { name?: string; phone?: string | null }): Promise<UserModel> {
    const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    if (Object.keys(changes).length > 0) await this.users.update({ id }, changes);
    return this.getOrFail(this.users, id);
  }

  async setRehabFollowupEnabled(id: string, enabled: boolean, manager?: EntityManager): Promise<UserModel> {
    const repository = manager ? manager.getRepository(User) : this.users;
    const user = await this.getOrFail(repository, id);
    await repository.update({ id }, { rehabFollowupEnabled: enabled });
    return { ...user, rehabFollowupEnabled: enabled };
  }

  toMeDto(user: UserModel): MeDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      rehabFollowupEnabled: user.rehabFollowupEnabled,
    };
  }

  private async getOrFail(repository: Repository<User>, id: string): Promise<UserModel> {
    const user = await repository.findOneBy({ id });
    if (!user) throw new AppError('USER_NOT_FOUND');
    return toModel(user);
  }
}
