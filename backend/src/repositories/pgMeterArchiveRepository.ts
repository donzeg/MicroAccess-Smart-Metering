import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import type { MeterArchiveRepository } from './meterArchiveRepository.js';
import type {
  ArchivedMeterIdentity,
  ArchivedUsageInterval,
  MeterArchiveReadingInput,
  MeterArchiveStatusInput,
  MeterArchiveSyncCounts,
  MeterArchiveSyncStatus
} from '../types/meterArchive.js';
import type { SteamaMeterReadingPoint } from '../types/steamaOperations.js';

const PROVIDER = 'SteamaCo';
const CHUNK_SIZE = 250;

const chunks = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const emptyCounts = (): MeterArchiveSyncCounts => ({
  readingsObserved: 0,
  readingsStored: 0,
  statusesObserved: 0,
  statusesStored: 0
});

export class PgMeterArchiveRepository implements MeterArchiveRepository {
  constructor(private readonly pool: Pool) {}

  async upsertReadings(readings: MeterArchiveReadingInput[]): Promise<number> {
    let stored = 0;
    const observedAt = new Date().toISOString();
    for (const batch of chunks(readings, CHUNK_SIZE)) {
      if (batch.length === 0) continue;
      const values: unknown[] = [];
      const rows = batch.map((reading, index) => {
        const offset = index * 14;
        values.push(
          randomUUID(),
          PROVIDER,
          reading.meterId,
          reading.meterNumber,
          reading.timestamp,
          reading.intervalStart,
          reading.readingKwh,
          reading.usageKwh,
          reading.anomalous,
          reading.customerId,
          reading.customerName,
          reading.source,
          observedAt,
          observedAt
        );
        return `(${Array.from({ length: 14 }, (_, valueIndex) => `$${offset + valueIndex + 1}`).join(', ')})`;
      });
      const result = await this.pool.query(
        `INSERT INTO meter_reading_archive (
           id, provider, provider_meter_id, meter_number, recorded_at, interval_start,
           reading_kwh, usage_kwh, anomalous, customer_provider_id, customer_name,
           source_kind, first_observed_at, last_observed_at
         ) VALUES ${rows.join(', ')}
         ON CONFLICT (provider, provider_meter_id, recorded_at, source_kind) DO UPDATE SET
           meter_number = EXCLUDED.meter_number,
           interval_start = COALESCE(EXCLUDED.interval_start, meter_reading_archive.interval_start),
           reading_kwh = COALESCE(EXCLUDED.reading_kwh, meter_reading_archive.reading_kwh),
           usage_kwh = COALESCE(EXCLUDED.usage_kwh, meter_reading_archive.usage_kwh),
           anomalous = EXCLUDED.anomalous,
           customer_provider_id = COALESCE(EXCLUDED.customer_provider_id, meter_reading_archive.customer_provider_id),
           customer_name = COALESCE(EXCLUDED.customer_name, meter_reading_archive.customer_name),
           last_observed_at = EXCLUDED.last_observed_at`,
        values
      );
      stored += result.rowCount ?? 0;
    }
    return stored;
  }

  async recordStatuses(statuses: MeterArchiveStatusInput[]): Promise<number> {
    let stored = 0;
    for (const batch of chunks(statuses, CHUNK_SIZE)) {
      if (batch.length === 0) continue;
      const values: unknown[] = [];
      const rows = batch.map((status, index) => {
        const offset = index * 13;
        values.push(
          randomUUID(),
          PROVIDER,
          status.providerMeterId,
          status.meterNumber,
          status.meterName,
          status.model,
          status.customerId,
          status.customerName,
          status.connectivity,
          status.connectivityLabel,
          status.lastReadingAt,
          status.relayOn,
          status.observedAt
        );
        return `(${Array.from({ length: 13 }, (_, valueIndex) => `$${offset + valueIndex + 1}`).join(', ')})`;
      });
      const result = await this.pool.query(
        `INSERT INTO meter_status_archive (
           id, provider, provider_meter_id, meter_number, meter_name, model,
           customer_provider_id, customer_name, connectivity, connectivity_label,
           last_reading_at, relay_on, observed_at
         ) VALUES ${rows.join(', ')}
         ON CONFLICT (provider, provider_meter_id, observed_at) DO UPDATE SET
           meter_number = EXCLUDED.meter_number,
           meter_name = EXCLUDED.meter_name,
           model = EXCLUDED.model,
           customer_provider_id = EXCLUDED.customer_provider_id,
           customer_name = EXCLUDED.customer_name,
           connectivity = EXCLUDED.connectivity,
           connectivity_label = EXCLUDED.connectivity_label,
           last_reading_at = EXCLUDED.last_reading_at,
           relay_on = EXCLUDED.relay_on`,
        values
      );
      stored += result.rowCount ?? 0;
    }
    return stored;
  }

  async listMeterReadings(providerMeterId: string, meterNumber?: string): Promise<SteamaMeterReadingPoint[]> {
    const result = await this.pool.query<{
      timestamp: Date;
      reading_kwh: string | null;
      usage_kwh: string | null;
      anomalous: boolean;
      provider_meter_id: string;
      meter_number: string;
      customer_provider_id: string | null;
      customer_name: string | null;
    }>(
      `SELECT
         recorded_at AS timestamp,
         MAX(reading_kwh) AS reading_kwh,
         COALESCE(
           MAX(usage_kwh) FILTER (WHERE source_kind = 'meter_directive'),
           MAX(usage_kwh) FILTER (WHERE source_kind = 'utility_reading')
         ) AS usage_kwh,
         BOOL_OR(anomalous) AS anomalous,
         MAX(provider_meter_id) AS provider_meter_id,
         MAX(meter_number) AS meter_number,
         MAX(customer_provider_id) AS customer_provider_id,
         MAX(customer_name) AS customer_name
       FROM meter_reading_archive
       WHERE provider = $1 AND (provider_meter_id = $2 OR ($3::text IS NOT NULL AND meter_number = $3))
       GROUP BY recorded_at
       ORDER BY recorded_at ASC`,
      [PROVIDER, providerMeterId, meterNumber ?? null]
    );
    return result.rows.map((row) => ({
      timestamp: row.timestamp.toISOString(),
      readingKwh: row.reading_kwh === null ? null : Number(row.reading_kwh),
      usageKwh: row.usage_kwh === null ? null : Number(row.usage_kwh),
      anomalous: row.anomalous,
      meterId: row.provider_meter_id,
      meterNumber: row.meter_number,
      customerId: row.customer_provider_id,
      customerName: row.customer_name
    }));
  }

  async listUsageIntervals(providerMeterId: string, from: string, to: string): Promise<ArchivedUsageInterval[]> {
    const result = await this.pool.query<{
      timestamp: Date;
      interval_start: Date;
      usage_kwh: string;
    }>(
      `SELECT DISTINCT ON (interval_start)
         recorded_at AS timestamp, interval_start, usage_kwh
       FROM meter_reading_archive
       WHERE provider = $1
         AND provider_meter_id = $2
         AND interval_start >= $3
         AND interval_start < $4
         AND usage_kwh IS NOT NULL
         AND usage_kwh >= 0
       ORDER BY interval_start ASC,
         CASE source_kind WHEN 'meter_directive' THEN 0 ELSE 1 END ASC`,
      [PROVIDER, providerMeterId, from, to]
    );
    return result.rows.map((row) => ({
      timestamp: row.timestamp.toISOString(),
      intervalStart: row.interval_start.toISOString(),
      usageKwh: Number(row.usage_kwh)
    }));
  }

  async latestUsageRecordedAt(providerMeterId: string): Promise<string | null> {
    const result = await this.pool.query<{ latest: Date | null }>(
      `SELECT MAX(recorded_at) AS latest
       FROM meter_reading_archive
       WHERE provider = $1 AND provider_meter_id = $2 AND usage_kwh IS NOT NULL`,
      [PROVIDER, providerMeterId]
    );
    return result.rows[0]?.latest?.toISOString() ?? null;
  }

  async findMeterIdentity(providerMeterId: string): Promise<ArchivedMeterIdentity | null> {
    const result = await this.pool.query<{ provider_meter_id: string; meter_number: string; meter_name: string }>(
      `SELECT provider_meter_id, meter_number, meter_name
       FROM meter_status_archive
       WHERE provider = $1 AND provider_meter_id = $2
       ORDER BY observed_at DESC
       LIMIT 1`,
      [PROVIDER, providerMeterId]
    );
    const row = result.rows[0];
    return row
      ? { providerId: row.provider_meter_id, meterNumber: row.meter_number, name: row.meter_name }
      : null;
  }

  async beginSync(runId: string, startedAt: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO meter_archive_sync_runs (id, provider, state, started_at)
       VALUES ($1, $2, 'running', $3)`,
      [runId, PROVIDER, startedAt]
    );
  }

  async completeSync(runId: string, completedAt: string, counts: MeterArchiveSyncCounts): Promise<void> {
    await this.pool.query(
      `UPDATE meter_archive_sync_runs SET
         state = 'succeeded', completed_at = $2, readings_observed = $3,
         readings_stored = $4, statuses_observed = $5, statuses_stored = $6,
         safe_error_code = NULL
       WHERE id = $1`,
      [
        runId,
        completedAt,
        counts.readingsObserved,
        counts.readingsStored,
        counts.statusesObserved,
        counts.statusesStored
      ]
    );
  }

  async failSync(runId: string, completedAt: string, safeErrorCode: string): Promise<void> {
    await this.pool.query(
      `UPDATE meter_archive_sync_runs
       SET state = 'failed', completed_at = $2, safe_error_code = $3
       WHERE id = $1`,
      [runId, completedAt, safeErrorCode]
    );
  }

  async getSyncStatus(enabled: boolean): Promise<MeterArchiveSyncStatus> {
    const [runResult, successResult, readingResult] = await Promise.all([
      this.pool.query<{
        state: 'running' | 'succeeded' | 'failed';
        started_at: Date;
        completed_at: Date | null;
        readings_observed: number;
        readings_stored: number;
        statuses_observed: number;
        statuses_stored: number;
        safe_error_code: string | null;
      }>(`SELECT * FROM meter_archive_sync_runs WHERE provider = $1 ORDER BY started_at DESC LIMIT 1`, [PROVIDER]),
      this.pool.query<{ completed_at: Date }>(
        `SELECT completed_at FROM meter_archive_sync_runs
         WHERE provider = $1 AND state = 'succeeded' AND completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT 1`,
        [PROVIDER]
      ),
      this.pool.query<{ total: string; earliest: Date | null; latest: Date | null }>(
        `SELECT COUNT(*)::text AS total, MIN(recorded_at) AS earliest, MAX(recorded_at) AS latest
         FROM meter_reading_archive WHERE provider = $1`,
        [PROVIDER]
      )
    ]);
    const run = runResult.rows[0];
    const reading = readingResult.rows[0];
    return {
      enabled,
      state: run?.state ?? 'not_started',
      lastStartedAt: run?.started_at.toISOString() ?? null,
      lastCompletedAt: run?.completed_at?.toISOString() ?? null,
      lastSuccessfulAt: successResult.rows[0]?.completed_at.toISOString() ?? null,
      lastErrorCode: run?.safe_error_code ?? null,
      lastCounts: run
        ? {
            readingsObserved: run.readings_observed,
            readingsStored: run.readings_stored,
            statusesObserved: run.statuses_observed,
            statusesStored: run.statuses_stored
          }
        : emptyCounts(),
      totalArchivedReadings: Number(reading?.total ?? 0),
      earliestReadingAt: reading?.earliest?.toISOString() ?? null,
      latestReadingAt: reading?.latest?.toISOString() ?? null
    };
  }
}
