import { describe, expect, it } from 'vitest';

import { recoverUsageFromRegister } from '../../src/services/registerUsageRecovery.js';

const start = new Date('2026-01-01T00:00:00.000Z').getTime();
const end = new Date('2027-01-01T00:00:00.000Z').getTime();

describe('recoverUsageFromRegister', () => {
  it('turns an unreported 17,000 to 21,000 register jump into 4,000 kWh exactly once', () => {
    const result = recoverUsageFromRegister({
      intervals: [],
      registerReadings: [
        { timestamp: '2026-10-01T10:00:00.000Z', readingKwh: 17_000, anomalous: false },
        { timestamp: '2026-10-03T10:00:00.000Z', readingKwh: 21_000, anomalous: false }
      ],
      rangeStartMs: start,
      rangeEndMs: end
    });

    expect(result.registerRecoveredKwh).toBe(4_000);
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]).toMatchObject({ usageKwh: 4_000, recordedUsageKwh: 0 });
  });

  it('does not double count a register jump already represented by interval usage', () => {
    const result = recoverUsageFromRegister({
      intervals: [{
        timestamp: '2026-10-03T10:00:00.000Z',
        intervalStart: '2026-10-03T09:00:00.000Z',
        usageKwh: 4_000
      }],
      registerReadings: [
        { timestamp: '2026-10-01T10:00:00.000Z', readingKwh: 17_000, anomalous: false },
        { timestamp: '2026-10-03T10:00:00.000Z', readingKwh: 21_000, anomalous: false }
      ],
      rangeStartMs: start,
      rangeEndMs: end
    });

    expect(result.recordedUsageKwh).toBe(4_000);
    expect(result.registerRecoveredKwh).toBe(0);
    expect(result.intervals.reduce((sum, interval) => sum + interval.usageKwh, 0)).toBe(4_000);
  });

  it('ignores a malformed low register so it cannot create a false later increase', () => {
    const result = recoverUsageFromRegister({
      intervals: [],
      registerReadings: [
        { timestamp: '2026-11-01T10:00:00.000Z', readingKwh: 17_341, anomalous: false },
        { timestamp: '2026-11-01T11:00:00.000Z', readingKwh: 173.49, anomalous: false },
        { timestamp: '2026-11-01T12:00:00.000Z', readingKwh: 17_354, anomalous: false }
      ],
      rangeStartMs: start,
      rangeEndMs: end
    });

    expect(result.registerRecoveredKwh).toBe(13);
    expect(result.ignoredRegisterDrops).toBe(1);
  });

  it('uses an explicit commissioning baseline to include the first observed cumulative register', () => {
    const result = recoverUsageFromRegister({
      intervals: [{
        timestamp: '2026-11-01T10:00:00.000Z',
        intervalStart: '2026-11-01T09:00:00.000Z',
        usageKwh: 1_000
      }],
      registerReadings: [
        { timestamp: '2026-11-01T10:00:00.000Z', readingKwh: 31_881, anomalous: false }
      ],
      baseline: { meterNumber: 'SOLAR', readingKwh: 0, effectiveAt: '2026-01-01T00:00:00.000Z' },
      rangeStartMs: start,
      rangeEndMs: end
    });

    expect(result.recordedUsageKwh).toBe(1_000);
    expect(result.registerRecoveredKwh).toBe(30_881);
    expect(result.intervals.reduce((sum, interval) => sum + interval.usageKwh, 0)).toBe(31_881);
  });

  it('does not import a commissioning baseline that predates a shorter reporting window', () => {
    const rangeStartMs = new Date('2026-11-01T00:00:00.000Z').getTime();
    const result = recoverUsageFromRegister({
      intervals: [],
      registerReadings: [
        { timestamp: '2026-11-02T10:00:00.000Z', readingKwh: 31_881, anomalous: false }
      ],
      baseline: { meterNumber: 'SOLAR', readingKwh: 0, effectiveAt: '2026-01-01T00:00:00.000Z' },
      rangeStartMs,
      rangeEndMs: end
    });

    expect(result.registerRecoveredKwh).toBe(0);
  });
});
