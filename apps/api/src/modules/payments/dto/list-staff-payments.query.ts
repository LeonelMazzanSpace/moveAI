import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.js';
import type { PurchaseMethod, PurchaseStatus } from '../entities/purchase.entity.js';

const PURCHASE_STATUSES: PurchaseStatus[] = ['pending', 'approved', 'rejected', 'cancelled', 'expired'];
const PURCHASE_METHODS: PurchaseMethod[] = ['mercadopago', 'cash', 'transfer'];

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListStaffPaymentsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PURCHASE_STATUSES)
  status?: PurchaseStatus;

  @IsOptional()
  @IsIn(PURCHASE_METHODS)
  method?: PurchaseMethod;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  needsAttention?: boolean;
}
