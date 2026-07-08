import { describe, expect, it } from 'vitest';

import { InMemoryPurchaseAuditLogRepository } from '../../src/repositories/inMemoryPurchaseAuditLogRepository.js';
import { InMemoryPurchaseRepository } from '../../src/repositories/inMemoryPurchaseRepository.js';
import { ProviderClient } from '../../src/services/providerClient.js';
import { PurchaseService } from '../../src/services/purchaseService.js';

class AlwaysFailProvider {
  async postCustomerCredit(): Promise<{
    status: 'failed';
    providerReference: string;
    reason: string;
  }> {
    return {
      status: 'failed',
      providerReference: 'provider-failed-ref',
      reason: 'provider_unavailable'
    };
  }
}

describe('PurchaseService', () => {
  it('moves purchase to credited when provider credit succeeds', async () => {
    const service = new PurchaseService(
      new ProviderClient(),
      new InMemoryPurchaseRepository(),
      new InMemoryPurchaseAuditLogRepository()
    );

    const initiated = await service.initiate('1622913', 5000, 'corr-1');
    const initiatedState = initiated.state;
    const pending = await service.markPaymentConfirmed(initiated.id, 'corr-2');
    const pendingState = pending.state;
    const credited = await service.creditViaProvider(initiated.id, 'corr-3');

    expect(initiatedState).toBe('initiated');
    expect(pendingState).toBe('payment_confirmed_credit_pending');
    expect(credited.state).toBe('credited');
    expect(credited.providerReference).toBeTruthy();
    expect(credited.transitions).toHaveLength(3);
  });

  it('uses idempotency result when provider endpoint is retried', async () => {
    const service = new PurchaseService(
      new ProviderClient(),
      new InMemoryPurchaseRepository(),
      new InMemoryPurchaseAuditLogRepository()
    );

    const purchase = await service.initiate('1622913', 5000, 'corr-1');
    await service.markPaymentConfirmed(purchase.id, 'corr-2');

    const first = await service.creditViaProvider(purchase.id, 'corr-3');
    const second = await service.creditViaProvider(purchase.id, 'corr-4');

    expect(second.state).toBe('credited');
    expect(second.providerReference).toBe(first.providerReference);
  });

  it('processes payment callback and keeps purchase pending until retry credit', async () => {
    const service = new PurchaseService(
      new ProviderClient(),
      new InMemoryPurchaseRepository(),
      new InMemoryPurchaseAuditLogRepository()
    );

    const purchase = await service.initiate('1622913', 5000, 'corr-1');
    const callbackResult = await service.processPaymentCallback(
      {
        purchaseId: purchase.id,
        status: 'confirmed'
      },
      'corr-2'
    );

    expect(callbackResult.state).toBe('payment_confirmed_credit_pending');

    const retryResult = await service.retryPendingCredits(10, 'corr-3');
    expect(retryResult.attempted).toBe(1);
    expect(retryResult.credited).toBe(1);
    expect(retryResult.failureReasons).toEqual({});

    const finalRecord = await service.getById(purchase.id);
    expect(finalRecord.state).toBe('credited');
  });

  it('aggregates failure reasons when retrying pending credits', async () => {
    const service = new PurchaseService(
      new AlwaysFailProvider(),
      new InMemoryPurchaseRepository(),
      new InMemoryPurchaseAuditLogRepository()
    );

    const purchase = await service.initiate('1622913', 5000, 'corr-1');
    await service.markPaymentConfirmed(purchase.id, 'corr-2');

    const retryResult = await service.retryPendingCredits(10, 'corr-3');

    expect(retryResult.attempted).toBe(1);
    expect(retryResult.credited).toBe(0);
    expect(retryResult.failed).toBe(1);
    expect(retryResult.failureReasons).toEqual({ provider_unavailable: 1 });
  });

  it('reconciles failed purchases in batch mode', async () => {
    const service = new PurchaseService(
      new ProviderClient(),
      new InMemoryPurchaseRepository(),
      new InMemoryPurchaseAuditLogRepository()
    );

    const purchase = await service.initiate('1622913', 5000, 'corr-1');
    await service.processPaymentCallback(
      {
        purchaseId: purchase.id,
        status: 'failed'
      },
      'corr-2'
    );

    const reconcileResult = await service.reconcileFailedPurchases(10, 'corr-3');

    expect(reconcileResult.attempted).toBe(1);
    expect(reconcileResult.reconciled).toBe(1);
    expect(reconcileResult.stillFailed).toBe(0);

    const updated = await service.getById(purchase.id);
    expect(updated.state).toBe('reconciled');
  });
});