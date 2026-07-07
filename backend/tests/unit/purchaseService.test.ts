import { describe, expect, it } from 'vitest';

import { ProviderClient } from '../../src/services/providerClient.js';
import { PurchaseService } from '../../src/services/purchaseService.js';

describe('PurchaseService', () => {
  it('moves purchase to credited when provider credit succeeds', async () => {
    const service = new PurchaseService(new ProviderClient());

    const initiated = service.initiate('1622913', 5000, 'corr-1');
    const pending = service.markPaymentConfirmed(initiated.id, 'corr-2');
    const credited = await service.creditViaProvider(initiated.id, 'corr-3');

    expect(initiated.state).toBe('initiated');
    expect(pending.state).toBe('payment_confirmed_credit_pending');
    expect(credited.state).toBe('credited');
    expect(credited.providerReference).toBeTruthy();
    expect(credited.transitions).toHaveLength(3);
  });

  it('uses idempotency result when provider endpoint is retried', async () => {
    const service = new PurchaseService(new ProviderClient());

    const purchase = service.initiate('1622913', 5000, 'corr-1');
    service.markPaymentConfirmed(purchase.id, 'corr-2');

    const first = await service.creditViaProvider(purchase.id, 'corr-3');
    const second = await service.creditViaProvider(purchase.id, 'corr-4');

    expect(second.state).toBe('credited');
    expect(second.providerReference).toBe(first.providerReference);
  });
});