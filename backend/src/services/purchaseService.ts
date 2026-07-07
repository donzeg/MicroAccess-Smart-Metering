import { randomUUID } from 'node:crypto';
import { ProviderClient } from './providerClient.js';
import type { PurchaseRecord, PurchaseState } from '../types/purchase.js';

export class PurchaseService {
  private readonly purchases = new Map<string, PurchaseRecord>();

  constructor(private readonly providerClient: ProviderClient) {}

  initiate(customerId: string, amount: number, correlationId: string): PurchaseRecord {
    const now = new Date().toISOString();
    const record: PurchaseRecord = {
      id: randomUUID(),
      customerId,
      amount,
      state: 'initiated',
      idempotencyKey: randomUUID(),
      providerReference: null,
      createdAt: now,
      updatedAt: now,
      transitions: [
        {
          state: 'initiated',
          at: now,
          correlationId,
          note: 'Purchase initiated by client request.'
        }
      ]
    };

    this.purchases.set(record.id, record);
    return record;
  }

  markPaymentConfirmed(purchaseId: string, correlationId: string): PurchaseRecord {
    const record = this.mustGet(purchaseId);
    if (record.state !== 'initiated') {
      return record;
    }

    return this.transition(record, 'payment_confirmed_credit_pending', correlationId, 'Payment confirmed; awaiting provider credit.');
  }

  async creditViaProvider(purchaseId: string, correlationId: string): Promise<PurchaseRecord> {
    const record = this.mustGet(purchaseId);
    if (record.state === 'credited' || record.state === 'reconciled') {
      return record;
    }

    if (record.state === 'initiated') {
      this.transition(record, 'payment_confirmed_credit_pending', correlationId, 'Auto-moved to pending before credit posting.');
    }

    const result = await this.providerClient.postCustomerCredit({
      customerId: record.customerId,
      amount: record.amount,
      idempotencyKey: record.idempotencyKey
    });

    if (result.status === 'success') {
      record.providerReference = result.providerReference;
      return this.transition(record, 'credited', correlationId, 'Provider credit succeeded.');
    }

    record.providerReference = result.providerReference;
    return this.transition(record, 'failed', correlationId, `Provider credit failed: ${result.reason ?? 'unknown_reason'}`);
  }

  reconcile(purchaseId: string, correlationId: string): PurchaseRecord {
    const record = this.mustGet(purchaseId);
    if (record.state !== 'failed') {
      return record;
    }

    return this.transition(record, 'reconciled', correlationId, 'Manual or scheduled reconciliation completed.');
  }

  getById(purchaseId: string): PurchaseRecord {
    return this.mustGet(purchaseId);
  }

  private mustGet(purchaseId: string): PurchaseRecord {
    const record = this.purchases.get(purchaseId);
    if (!record) {
      throw new Error('purchase_not_found');
    }
    return record;
  }

  private transition(record: PurchaseRecord, state: PurchaseState, correlationId: string, note: string): PurchaseRecord {
    const now = new Date().toISOString();
    record.state = state;
    record.updatedAt = now;
    record.transitions.push({
      state,
      at: now,
      correlationId,
      note
    });
    return record;
  }
}
