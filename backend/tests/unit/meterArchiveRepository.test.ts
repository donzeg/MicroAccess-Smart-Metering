import { describe, expect, it } from 'vitest';

import { InMemoryMeterArchiveRepository } from '../../src/repositories/inMemoryMeterArchiveRepository.js';

describe('InMemoryMeterArchiveRepository', () => {
  it('retains old readings idempotently and combines register and interval sources', async () => {
    const repository = new InMemoryMeterArchiveRepository();
    const timestamp = '2026-06-01T10:00:00.000Z';

    await repository.upsertReadings([
      {
        source: 'utility_reading',
        intervalStart: '2026-06-01T09:00:00.000Z',
        timestamp,
        readingKwh: 1200,
        usageKwh: 7,
        anomalous: false,
        meterId: '1',
        meterNumber: 'MTR-001',
        customerId: '10',
        customerName: 'Ground Floor -01 Tenant'
      },
      {
        source: 'meter_directive',
        intervalStart: '2026-06-01T09:00:00.000Z',
        timestamp,
        readingKwh: null,
        usageKwh: 8,
        anomalous: false,
        meterId: '1',
        meterNumber: 'MTR-001',
        customerId: '10',
        customerName: 'Ground Floor -01 Tenant'
      }
    ]);
    await repository.upsertReadings([
      {
        source: 'utility_reading',
        intervalStart: '2026-06-01T09:00:00.000Z',
        timestamp,
        readingKwh: 1200,
        usageKwh: 7,
        anomalous: false,
        meterId: '1',
        meterNumber: 'MTR-001',
        customerId: '10',
        customerName: 'Ground Floor -01 Tenant'
      }
    ]);

    await expect(repository.listMeterReadings('1')).resolves.toEqual([
      expect.objectContaining({ timestamp, readingKwh: 1200, usageKwh: 8 })
    ]);
    await expect(repository.latestUsageRecordedAt('1')).resolves.toBe(timestamp);
    await expect(repository.getSyncStatus(true)).resolves.toMatchObject({ totalArchivedReadings: 2 });
  });

  it('retains the latest successful operational snapshot independently from provider availability', async () => {
    const repository = new InMemoryMeterArchiveRepository();
    const retrievedAt = '2026-11-13T21:00:00.000Z';
    await repository.saveOperationalSnapshot('overview', { totalMeters: 31 }, retrievedAt);

    await expect(repository.getOperationalSnapshot<{ totalMeters: number }>('overview')).resolves.toEqual({
      value: { totalMeters: 31 },
      retrievedAt
    });
  });
});
