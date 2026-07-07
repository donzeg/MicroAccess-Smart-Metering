export type PurchaseState =
  | 'initiated'
  | 'payment_confirmed_credit_pending'
  | 'credited'
  | 'failed'
  | 'reconciled';

export interface PurchaseTransition {
  state: PurchaseState;
  at: string;
  correlationId: string;
  note: string;
}

export interface PurchaseRecord {
  id: string;
  customerId: string;
  amount: number;
  state: PurchaseState;
  idempotencyKey: string;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
  transitions: PurchaseTransition[];
}
