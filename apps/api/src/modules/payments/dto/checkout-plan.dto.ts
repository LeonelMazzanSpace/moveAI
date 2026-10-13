import { IsUUID } from 'class-validator';

export class CheckoutPlanDto {
  @IsUUID()
  planId: string;
}
