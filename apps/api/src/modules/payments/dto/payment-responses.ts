import type { Service } from '../../catalog/entities/plan.entity.js';
import type { PurchaseKind, PurchaseMethod, PurchaseStatus } from '../entities/purchase.entity.js';

// Response shapes of the HTTP contract.

export interface CheckoutResponseDto {
  purchaseId: string;
  externalReference: string;
  initPoint: string;
  bookingId: string | null;
  holdExpiresAt: string | null;
}

export interface PurchaseStatusDto {
  externalReference: string;
  status: PurchaseStatus;
  kind: PurchaseKind;
  itemName: string;
  service: Service;
  amount: number;
  bookingId: string | null;
  startsAt: string | null;
  needsAttention: boolean;
  planSlug: string | null;
}

export interface StaffPaymentDto {
  purchaseId: string;
  client: { id: string; name: string; email: string };
  itemName: string;
  service: Service;
  amount: number;
  method: PurchaseMethod;
  status: PurchaseStatus;
  needsAttention: boolean;
  createdAt: string;
  approvedAt: string | null;
  note: string | null;
}
