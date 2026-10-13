// A payment as read from the Mercado Pago API (or built by the development simulator), never from a webhook body.
export type ProviderPaymentStatus = 'pending' | 'in_process' | 'approved' | 'rejected' | 'cancelled' | 'refunded';

export interface ProviderPayment {
  id: string;
  status: ProviderPaymentStatus;
  statusDetail: string | null;
  externalReference: string;
  transactionAmount: number;
}
