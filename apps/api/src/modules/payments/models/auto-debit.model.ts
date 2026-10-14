import type {
  AutoDebitCancelReason, AutoDebitFrequencyType, AutoDebitService, AutoDebitStatus,
} from '../entities/auto-debit.entity.js';

export type { AutoDebitCancelReason, AutoDebitFrequencyType, AutoDebitService, AutoDebitStatus };

// Response shapes of the Feedback contract (D96/D97).

export interface AutoDebitDto {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  service: AutoDebitService;
  status: AutoDebitStatus;
  amount: number;
  frequency: number;
  frequencyType: AutoDebitFrequencyType;
  nextChargeDate: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: AutoDebitCancelReason | null;
}

export interface AutoDebitCheckoutDto {
  externalReference: string;
  initPoint: string;
}

export interface AutoDebitStatusDto {
  externalReference: string;
  status: AutoDebitStatus;
  planName: string;
  planSlug: string;
  service: AutoDebitService;
  amount: number;
  nextChargeDate: string | null;
}

// A debit as the payments services read it, with the plan fields needed to activate each charge.
export interface AutoDebitModel {
  id: string;
  userId: string;
  externalReference: string;
  mpPreapprovalId: string | null;
  service: AutoDebitService;
  status: AutoDebitStatus;
  amount: number;
  frequency: number;
  frequencyType: AutoDebitFrequencyType;
  nextChargeDate: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelReason: AutoDebitCancelReason | null;
  planId: string;
  planName: string;
  planSlug: string;
}
