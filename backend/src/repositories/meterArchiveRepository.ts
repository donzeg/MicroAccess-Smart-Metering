import type {
  ArchivedMeterIdentity,
  ArchivedUsageInterval,
  MeterArchiveReadingInput,
  MeterArchiveStatusInput,
  MeterArchiveTransactionInput,
  MeterArchiveSyncCounts,
  MeterArchiveSyncStatus
} from '../types/meterArchive.js';
import type { SteamaMeterReadingPoint } from '../types/steamaOperations.js';

export interface MeterArchiveRepository {
  upsertReadings(readings: MeterArchiveReadingInput[]): Promise<number>;
  recordStatuses(statuses: MeterArchiveStatusInput[]): Promise<number>;
  listMeterReadings(providerMeterId: string, meterNumber?: string): Promise<SteamaMeterReadingPoint[]>;
  listUsageIntervals(providerMeterId: string, from: string, to: string): Promise<ArchivedUsageInterval[]>;
  latestUsageRecordedAt(providerMeterId: string): Promise<string | null>;
  findMeterIdentity(providerMeterId: string): Promise<ArchivedMeterIdentity | null>;
  upsertTransactions(transactions: MeterArchiveTransactionInput[]): Promise<number>;
  listTransactions(category: 'UCH' | 'PAY', from: string, to: string): Promise<MeterArchiveTransactionInput[]>;
  latestTransactionAt(category: 'UCH' | 'PAY'): Promise<string | null>;
  saveOperationalSnapshot<T>(key: string, value: T, retrievedAt: string): Promise<void>;
  getOperationalSnapshot<T>(key: string): Promise<{ value: T; retrievedAt: string } | null>;
  beginSync(runId: string, startedAt: string): Promise<void>;
  completeSync(runId: string, completedAt: string, counts: MeterArchiveSyncCounts): Promise<void>;
  failSync(runId: string, completedAt: string, safeErrorCode: string): Promise<void>;
  getSyncStatus(enabled: boolean): Promise<MeterArchiveSyncStatus>;
}
