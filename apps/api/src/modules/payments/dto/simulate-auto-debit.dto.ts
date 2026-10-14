import { IsIn, IsUUID } from 'class-validator';

export const SIMULATED_AUTO_DEBIT_ACTIONS = ['authorize', 'charge_approved', 'charge_rejected', 'cancel'] as const;

export type SimulatedAutoDebitAction = (typeof SIMULATED_AUTO_DEBIT_ACTIONS)[number];

export class SimulateAutoDebitDto {
  @IsUUID()
  externalReference: string;

  @IsIn(SIMULATED_AUTO_DEBIT_ACTIONS)
  action: SimulatedAutoDebitAction;
}
