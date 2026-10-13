import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.js';
import { FreeText, OptionalField } from '../../followup/dto/followup-fields.js';
import type { ClientStatus } from './client-responses.js';

export const CLIENT_STATUS_FILTERS = ['all', 'active', 'expiring', 'inactive', 'expired', 'paused', 'no_plan'] as const;

export type ClientStatusFilter = 'all' | ClientStatus;

const SEARCH_MAX = 100;

export class ListClientsQuery extends PaginationQueryDto {
  @OptionalField()
  @FreeText(SEARCH_MAX)
  q?: string;

  @IsOptional()
  @IsIn(CLIENT_STATUS_FILTERS)
  status: ClientStatusFilter = 'all';
}
