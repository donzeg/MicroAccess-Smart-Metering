import { describe, expect, it } from 'vitest';

import { InMemoryTariffRepository } from '../../src/repositories/inMemoryTariffRepository.js';

describe('InMemoryTariffRepository', () => {
  it('retains an effective-dated history when the provider tariff changes', async () => {
    const repository = new InMemoryTariffRepository();
    const bootstrap = await repository.ensureBootstrap({
      scopeKey: 'na-aka-hub',
      tariffBand: 'A',
      retailNgnPerKwh: 203,
      effectiveFrom: '2025-12-31T23:00:00.000Z',
      observedAt: '2026-11-15T08:00:00.000Z'
    });

    const confirmed = await repository.observeProviderTariff({
      scopeKey: 'na-aka-hub',
      tariffBand: 'A',
      retailNgnPerKwh: 203,
      providerCustomerCount: 20,
      observedAt: '2026-11-15T08:05:00.000Z'
    });
    const changed = await repository.observeProviderTariff({
      scopeKey: 'na-aka-hub',
      tariffBand: 'A',
      retailNgnPerKwh: 250,
      providerCustomerCount: 20,
      observedAt: '2026-12-01T00:00:00.000Z'
    });
    const versions = await repository.listForRange(
      'na-aka-hub',
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z'
    );

    expect(confirmed.id).toBe(bootstrap.id);
    expect(confirmed.providerCustomerCount).toBe(20);
    expect(changed).toMatchObject({ retailNgnPerKwh: 250, source: 'steama_observation' });
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({
      retailNgnPerKwh: 203,
      effectiveFrom: '2025-12-31T23:00:00.000Z',
      effectiveTo: '2026-12-01T00:00:00.000Z'
    });
    expect(await repository.getCurrent('na-aka-hub')).toMatchObject({ retailNgnPerKwh: 250 });
  });
});
