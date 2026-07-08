import { describe, expect, it } from 'vitest';

import { InMemoryPurchaseAuditLogRepository } from '../../src/repositories/inMemoryPurchaseAuditLogRepository.js';
import { InMemoryPurchaseRepository } from '../../src/repositories/inMemoryPurchaseRepository.js';
import { ProviderClient } from '../../src/services/providerClient.js';
import { PurchaseService } from '../../src/services/purchaseService.js';

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

    const finalRecord = await service.getById(purchase.id);
    expect(finalRecord.state).toBe('credited');
  });
});