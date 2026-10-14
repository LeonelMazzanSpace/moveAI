// A Mercado Pago subscription and its charges, as read from the Mercado Pago API (or built by the development
// simulator), never from a webhook body. `paused` exists only in Mercado Pago: MOVE treats it as authorized (D97).
export type ProviderPreapprovalStatus = 'pending' | 'authorized' | 'paused' | 'cancelled';

export interface ProviderPreapproval {
  id: string;
  status: ProviderPreapprovalStatus;
  externalReference: string;
  nextPaymentDate: string | null;
}

// One charge of a subscription. `paymentId` is null until Mercado Pago tries to collect it.
export interface ProviderAuthorizedPayment {
  id: string;
  preapprovalId: string;
  paymentId: string | null;
  status: string;
}
