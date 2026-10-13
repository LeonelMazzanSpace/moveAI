import { IsIn, IsUUID } from 'class-validator';

export const SIMULATED_OUTCOMES = ['approved', 'rejected'] as const;

export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];

export class SimulatePaymentDto {
  @IsUUID()
  externalReference: string;

  @IsIn(SIMULATED_OUTCOMES)
  outcome: SimulatedOutcome;
}
