import type { MeterConnectivity, SteamaMeterReadingPoint } from './steamaOperations.js';

export type MeterArchiveReadingSource = 'utility_reading' | 'meter_directive';

export interface MeterArchiveReadingInput extends SteamaMeterReadingPoint {
  source: MeterArchiveReadingSource;
  intervalStart: string | null;
}

export interface MeterArchiveStatusInput {
  observedAt: string;
  providerMeterId: string;
  meterNumber: string;
  meterName: string;
  model: string;
  customerId: string | null;
  customerName: string | null;
  connectivity: MeterConnectivity;
  connectivityLabel: string;
  lastReadingAt: string | null;
  relayOn: boolean | null;
}

export interface ArchivedMeterIdentity {
  providerId: string;
  meterNumber: string;
  name: string;
}

export interface ArchivedUsageInterval {
  timestamp: string;
  intervalStart: string;
  usageKwh: number;
}

export interface MeterArchiveSyncCounts {
  readingsObserved: number;
  readingsStored: number;
  statusesObserved: number;
  statusesStored: number;
}

export interface MeterArchiveSyncStatus {
  enabled: boolean;
  state: 'not_started' | 'running' | 'succeeded' | 'failed';
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessfulAt: string | null;
  lastErrorCode: string | null;
  lastCounts: MeterArchiveSyncCounts;
  totalArchivedReadings: number;
  earliestReadingAt: string | null;
  latestReadingAt: string | null;
}
