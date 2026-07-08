import { randomUUID } from 'node:crypto';
import type { CreditProvider } from './providerClient.js';
import type { PurchaseAuditLogRepository, PurchaseRepository } from '../repositories/interfaces.js';
import type { PaymentCallbackPayload, PurchaseAuditLog, PurchaseRecord, PurchaseState } from '../types/purchase.js';

export interface RetryPendingResult {
  attempted: number;
  credited: number;
  failed: number;
  failureReasons: Record<string, number>;
}

export interface ReconcileFailedResult {
  attempted: number;
  reconciled: number;
  stillFailed: number;
}

export class PurchaseService {
  constructor(
    private readonly providerClient: CreditProvider,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly purchaseAuditLogRepository: PurchaseAuditLogRepository
  ) {}

  async initiate(customerId: string, amount: number, correlationId: string): Promise<PurchaseRecord> {
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

    await this.purchaseRepository.create(record);
    await this.appendAudit({
      purchaseId: record.id,
      action: 'purchase_initiated',
      message: 'Purchase initiated by client request.',
      correlationId,
      metadata: {
        customerId,
        amount
      }
    });
    return record;
  }

  async markPaymentConfirmed(purchaseId: string, correlationId: string): Promise<PurchaseRecord> {
    const record = await this.mustGet(purchaseId);
    if (record.state !== 'initiated') {
      await this.appendAudit({
        purchaseId: record.id,
        action: 'payment_confirm_ignored',
        message: 'Payment confirmation skipped because purchase is not in initiated state.',
        correlationId,
        metadata: {
          currentState: record.state
        }
      });
      return record;
    }

    return this.transition(record, 'payment_confirmed_credit_pending', correlationId, 'Payment confirmed; awaiting provider credit.');
  }

  async creditViaProvider(purchaseId: string, correlationId: string): Promise<PurchaseRecord> {
    const record = await this.mustGet(purchaseId);
    if (record.state === 'credited' || record.state === 'reconciled') {
      await this.appendAudit({
        purchaseId: record.id,
        action: 'provider_credit_skipped',
        message: 'Provider credit skipped because purchase is already finalized.',
        correlationId,
        metadata: {
          currentState: record.state
        }
      });
      return record;
    }

    if (record.state === 'initiated') {
      await this.transition(record, 'payment_confirmed_credit_pending', correlationId, 'Auto-moved to pending before credit posting.');
    }

    await this.appendAudit({
      purchaseId: record.id,
      action: 'provider_credit_attempted',
      message: 'Attempting provider credit posting.',
      correlationId,
      metadata: {
        idempotencyKey: record.idempotencyKey,
        amount: record.amount
      }
    });

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

  async processPaymentCallback(payload: PaymentCallbackPayload, correlationId: string): Promise<PurchaseRecord> {
    const record = await this.mustGet(payload.purchaseId);

    await this.appendAudit({
      purchaseId: record.id,
      action: 'payment_callback_received',
      message: 'Payment callback received from payment provider.',
      correlationId,
      metadata: {
        callbackStatus: payload.status,
        callbackAmount: payload.amount ?? null,
        callbackProviderReference: payload.providerReference ?? null
      }
    });

    if (payload.status === 'failed') {
      return this.transition(record, 'failed', correlationId, 'Payment callback marked the payment as failed.');
    }

    return this.markPaymentConfirmed(record.id, correlationId);
  }

  async retryPendingCredits(limit: number, correlationId: string): Promise<RetryPendingResult> {
    const pendingPurchases = await this.purchaseRepository.listByState('payment_confirmed_credit_pending', limit);

    const result: RetryPendingResult = {
      attempted: pendingPurchases.length,
      credited: 0,
      failed: 0,
      failureReasons: {}
    };

    for (const purchase of pendingPurchases) {
      const updated = await this.creditViaProvider(purchase.id, correlationId);
      if (updated.state === 'credited') {
        result.credited += 1;
      } else if (updated.state === 'failed') {
        result.failed += 1;
        const reason = this.extractFailureReason(updated);
        result.failureReasons[reason] = (result.failureReasons[reason] ?? 0) + 1;
      }
    }

    return result;
  }

  private extractFailureReason(record: PurchaseRecord): string {
    const transition = record.transitions[record.transitions.length - 1];
    const note = transition?.note ?? '';
    const prefix = 'Provider credit failed: ';
    if (note.startsWith(prefix) && note.length > prefix.length) {
      return note.slice(prefix.length).trim();
    }

    return 'unknown_reason';
  }

  async reconcile(purchaseId: string, correlationId: string): Promise<PurchaseRecord> {
    const record = await this.mustGet(purchaseId);
    if (record.state !== 'failed') {
      await this.appendAudit({
        purchaseId: record.id,
        action: 'reconcile_skipped',
        message: 'Reconciliation skipped because purchase is not in failed state.',
        correlationId,
        metadata: {
          currentState: record.state
        }
      });
      return record;
    }

    return this.transition(record, 'reconciled', correlationId, 'Manual or scheduled reconciliation completed.');
  }

  async reconcileFailedPurchases(limit: number, correlationId: string): Promise<ReconcileFailedResult> {
    const failedPurchases = await this.purchaseRepository.listByState('failed', limit);

    const result: ReconcileFailedResult = {
      attempted: failedPurchases.length,
      reconciled: 0,
      stillFailed: 0
    };

    for (const purchase of failedPurchases) {
      const updated = await this.reconcile(purchase.id, correlationId);
      if (updated.state === 'reconciled') {
        result.reconciled += 1;
      } else if (updated.state === 'failed') {
        result.stillFailed += 1;
      }
    }

    return result;
  }

  async getById(purchaseId: string): Promise<PurchaseRecord> {
    return this.mustGet(purchaseId);
  }

  async getAuditLogs(purchaseId: string, limit = 100): Promise<PurchaseAuditLog[]> {
    return this.purchaseAuditLogRepository.listByPurchaseId(purchaseId, limit);
  }

  private async mustGet(purchaseId: string): Promise<PurchaseRecord> {
    const record = await this.purchaseRepository.getById(purchaseId);
    if (!record) {
      throw new Error('purchase_not_found');
    }
    return record;
  }

  private async transition(record: PurchaseRecord, state: PurchaseState, correlationId: string, note: string): Promise<PurchaseRecord> {
    const now = new Date().toISOString();
    record.state = state;
    record.updatedAt = now;
    record.transitions.push({
      state,
      at: now,
      correlationId,
      note
    });

    await this.purchaseRepository.update(record);
    await this.appendAudit({
      purchaseId: record.id,
      action: `state_transition_${state}`,
      message: note,
      correlationId,
      metadata: {
        state,
        providerReference: record.providerReference
      }
    });
    return record;
  }

  private async appendAudit(entry: Omit<PurchaseAuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.purchaseAuditLogRepository.append({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry
    });
  }
}
