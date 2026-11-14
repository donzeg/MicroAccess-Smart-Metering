import type { MeterArchiveRepository } from './meterArchiveRepository.js';
import type {
  ArchivedMeterIdentity,
  ArchivedRegisterReading,
  ArchivedUsageInterval,
  MeterArchiveReadingInput,
  MeterArchiveStatusInput,
  MeterArchiveTransactionInput,
  MeterArchiveSyncCounts,
  MeterArchiveSyncStatus
} from '../types/meterArchive.js';
import type { SteamaMeterReadingPoint } from '../types/steamaOperations.js';

interface SyncRun {
  state: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  completedAt: string | null;
  counts: MeterArchiveSyncCounts;
  safeErrorCode: string | null;
}

const emptyCounts = (): MeterArchiveSyncCounts => ({
  readingsObserved: 0,
  readingsStored: 0,
  statusesObserved: 0,
  statusesStored: 0,
  transactionsObserved: 0,
  transactionsStored: 0
});

export class InMemoryMeterArchiveRepository implements MeterArchiveRepository {
  private readonly readings = new Map<string, MeterArchiveReadingInput>();
  private readonly statuses: MeterArchiveStatusInput[] = [];
  private readonly runs = new Map<string, SyncRun>();
  private readonly operationalSnapshots = new Map<string, { value: unknown; retrievedAt: string }>();
  private readonly transactions = new Map<string, MeterArchiveTransactionInput>();
  private readonly transactionSyncCursors = new Map<'UCH' | 'PAY', string>();

  async upsertReadings(readings: MeterArchiveReadingInput[]): Promise<number> {
    for (const reading of readings) {
      const key = `${reading.source}:${reading.meterId}:${reading.timestamp}`;
      this.readings.set(key, { ...reading });
    }
    return readings.length;
  }

  async recordStatuses(statuses: MeterArchiveStatusInput[]): Promise<number> {
    this.statuses.push(...statuses.map((status) => ({ ...status })));
    return statuses.length;
  }

  async listMeterReadings(providerMeterId: string, meterNumber?: string): Promise<SteamaMeterReadingPoint[]> {
    const matching = Array.from(this.readings.values()).filter(
      (reading) => reading.meterId === providerMeterId || Boolean(meterNumber && reading.meterNumber === meterNumber)
    );
    const byTimestamp = new Map<string, MeterArchiveReadingInput>();
    for (const reading of matching) {
      const current = byTimestamp.get(reading.timestamp);
      byTimestamp.set(reading.timestamp, {
        ...(current ?? reading),
        ...reading,
        readingKwh: reading.readingKwh ?? current?.readingKwh ?? null,
        usageKwh:
          reading.source === 'meter_directive'
            ? reading.usageKwh ?? current?.usageKwh ?? null
            : current?.source === 'meter_directive'
              ? current.usageKwh
              : reading.usageKwh ?? current?.usageKwh ?? null
      });
    }
    return Array.from(byTimestamp.values())
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .map(({ source: _source, intervalStart: _intervalStart, ...reading }) => reading);
  }

  async listUsageIntervals(providerMeterId: string, from: string, to: string): Promise<ArchivedUsageInterval[]> {
    const byInterval = new Map<string, ArchivedUsageInterval>();
    const ordered = Array.from(this.readings.values())
      .filter(
        (reading) =>
          reading.meterId === providerMeterId &&
          reading.intervalStart !== null &&
          reading.usageKwh !== null &&
          reading.intervalStart >= from &&
          reading.intervalStart < to
      )
      .sort((left, right) =>
        (left.source === 'utility_reading' ? 0 : 1) - (right.source === 'utility_reading' ? 0 : 1)
      );
    for (const reading of ordered) {
      byInterval.set(reading.intervalStart!, {
        timestamp: reading.timestamp,
        intervalStart: reading.intervalStart!,
        usageKwh: reading.usageKwh!
      });
    }
    return Array.from(byInterval.values()).sort((left, right) => left.intervalStart.localeCompare(right.intervalStart));
  }

  async listRegisterReadings(providerMeterId: string, from: string, to: string): Promise<ArchivedRegisterReading[]> {
    const ordered = Array.from(this.readings.values())
      .filter(
        (reading) =>
          reading.meterId === providerMeterId &&
          reading.source === 'utility_reading' &&
          reading.readingKwh !== null
      )
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const predecessor = ordered.filter((reading) => reading.timestamp < from).at(-1);
    const inRange = ordered.filter((reading) => reading.timestamp >= from && reading.timestamp < to);
    return [...(predecessor ? [predecessor] : []), ...inRange].map((reading) => ({
      timestamp: reading.timestamp,
      readingKwh: reading.readingKwh!,
      anomalous: reading.anomalous
    }));
  }

  async latestUsageRecordedAt(providerMeterId: string): Promise<string | null> {
    const timestamps = Array.from(this.readings.values())
      .filter((reading) => reading.meterId === providerMeterId && reading.usageKwh !== null)
      .map((reading) => reading.timestamp)
      .sort();
    return timestamps.at(-1) ?? null;
  }

  async findMeterIdentity(providerMeterId: string): Promise<ArchivedMeterIdentity | null> {
    const status = [...this.statuses].reverse().find((item) => item.providerMeterId === providerMeterId);
    if (status) {
      return { providerId: providerMeterId, meterNumber: status.meterNumber, name: status.meterName };
    }
    const reading = Array.from(this.readings.values()).find((item) => item.meterId === providerMeterId);
    return reading
      ? { providerId: providerMeterId, meterNumber: reading.meterNumber, name: reading.meterNumber }
      : null;
  }

  async upsertTransactions(transactions: MeterArchiveTransactionInput[]): Promise<number> {
    for (const transaction of transactions) {
      const fallback = `${transaction.category}:${transaction.timestamp}:${transaction.customerId}:${transaction.amount}:${transaction.reference}`;
      this.transactions.set(transaction.providerId || fallback, { ...transaction });
    }
    return transactions.length;
  }

  async listTransactions(category: 'UCH' | 'PAY', from: string, to: string): Promise<MeterArchiveTransactionInput[]> {
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.category === category && transaction.timestamp >= from && transaction.timestamp < to)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .map((transaction) => ({ ...transaction }));
  }

  async latestTransactionAt(category: 'UCH' | 'PAY'): Promise<string | null> {
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.category === category)
      .map((transaction) => transaction.timestamp)
      .sort()
      .at(-1) ?? null;
  }

  async getTransactionSyncCursor(category: 'UCH' | 'PAY'): Promise<string | null> {
    return this.transactionSyncCursors.get(category) ?? null;
  }

  async saveTransactionSyncCursor(category: 'UCH' | 'PAY', syncedThrough: string): Promise<void> {
    this.transactionSyncCursors.set(category, syncedThrough);
  }

  async saveOperationalSnapshot<T>(key: string, value: T, retrievedAt: string): Promise<void> {
    this.operationalSnapshots.set(key, {
      value: structuredClone(value),
      retrievedAt
    });
  }

  async getOperationalSnapshot<T>(key: string): Promise<{ value: T; retrievedAt: string } | null> {
    const snapshot = this.operationalSnapshots.get(key);
    return snapshot
      ? { value: structuredClone(snapshot.value) as T, retrievedAt: snapshot.retrievedAt }
      : null;
  }

  async beginSync(runId: string, startedAt: string): Promise<void> {
    this.runs.set(runId, {
      state: 'running',
      startedAt,
      completedAt: null,
      counts: emptyCounts(),
      safeErrorCode: null
    });
  }

  async completeSync(runId: string, completedAt: string, counts: MeterArchiveSyncCounts): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    Object.assign(run, { state: 'succeeded', completedAt, counts, safeErrorCode: null });
  }

  async failSync(runId: string, completedAt: string, safeErrorCode: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    Object.assign(run, { state: 'failed', completedAt, safeErrorCode });
  }

  async getSyncStatus(enabled: boolean): Promise<MeterArchiveSyncStatus> {
    const latest = Array.from(this.runs.values()).at(-1) ?? null;
    const latestSuccessful = Array.from(this.runs.values()).filter((run) => run.state === 'succeeded').at(-1) ?? null;
    const timestamps = Array.from(this.readings.values()).map((reading) => reading.timestamp).sort();
    const transactionTimestamps = Array.from(this.transactions.values()).map((transaction) => transaction.timestamp).sort();
    return {
      enabled,
      state: latest?.state ?? 'not_started',
      lastStartedAt: latest?.startedAt ?? null,
      lastCompletedAt: latest?.completedAt ?? null,
      lastSuccessfulAt: latestSuccessful?.completedAt ?? null,
      lastErrorCode: latest?.safeErrorCode ?? null,
      lastCounts: latest?.counts ?? emptyCounts(),
      totalArchivedReadings: this.readings.size,
      earliestReadingAt: timestamps[0] ?? null,
      latestReadingAt: timestamps.at(-1) ?? null,
      totalArchivedTransactions: this.transactions.size,
      earliestTransactionAt: transactionTimestamps[0] ?? null,
      latestTransactionAt: transactionTimestamps.at(-1) ?? null
    };
  }
}
