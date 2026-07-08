import { randomUUID } from 'node:crypto';

import type {
  MeterReadingAggregateQuery,
  MeterReadingAggregateRow,
  MeterReadingAnalyticsMeterRow,
  MeterReadingAnalyticsQuery,
  MeterReadingAnalyticsSummary,
  MeterReadingRecord,
  MeterReadingSource,
  MeterReadingListQuery
} from '../types/meterReading.js';

interface IngestMeterReadingInput {
  meterId: string;
  readingKwh: number;
  source: MeterReadingSource;
  recordedAt: string;
}

const cloneRecord = (record: MeterReadingRecord): MeterReadingRecord => ({ ...record });

const toBucketStart = (recordedAt: string, bucket: 'hour' | 'day'): string => {
  const date = new Date(recordedAt);

  if (bucket === 'day') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours())).toISOString();
};

const round = (value: number): number => Number(value.toFixed(3));

export class MeterReadingService {
  private readonly store = new Map<string, MeterReadingRecord[]>();

  constructor() {
    this.seed();
  }

  ingest(input: IngestMeterReadingInput): MeterReadingRecord {
    const now = new Date().toISOString();
    const entry: MeterReadingRecord = {
      id: randomUUID(),
      meterId: input.meterId,
      readingKwh: input.readingKwh,
      source: input.source,
      recordedAt: input.recordedAt,
      ingestedAt: now
    };

    const meterReadings = this.store.get(input.meterId) ?? [];
    meterReadings.push(entry);
    meterReadings.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
    this.store.set(input.meterId, meterReadings);

    return cloneRecord(entry);
  }

  list(query: MeterReadingListQuery): MeterReadingRecord[] {
    const meterReadings = this.store.get(query.meterId) ?? [];

    return [...meterReadings]
      .filter((entry) => {
        if (query.fromRecordedAt && entry.recordedAt < query.fromRecordedAt) {
          return false;
        }

        if (query.toRecordedAt && entry.recordedAt > query.toRecordedAt) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .slice(query.offset, query.offset + query.limit)
      .map((entry) => cloneRecord(entry));
  }

  aggregate(query: MeterReadingAggregateQuery): MeterReadingAggregateRow[] {
    const meterReadings = this.list({
      meterId: query.meterId,
      fromRecordedAt: query.fromRecordedAt,
      toRecordedAt: query.toRecordedAt,
      limit: 10000,
      offset: 0
    });

    const groups = new Map<string, MeterReadingRecord[]>();

    for (const entry of meterReadings) {
      const bucketStart = toBucketStart(entry.recordedAt, query.bucket);
      const group = groups.get(bucketStart) ?? [];
      group.push(entry);
      groups.set(bucketStart, group);
    }

    return Array.from(groups.entries())
      .map(([bucketStart, entries]) => {
        const sumKwh = entries.reduce((sum, entry) => sum + entry.readingKwh, 0);
        const minKwh = Math.min(...entries.map((entry) => entry.readingKwh));
        const maxKwh = Math.max(...entries.map((entry) => entry.readingKwh));

        return {
          meterId: query.meterId,
          bucket: query.bucket,
          bucketStart,
          count: entries.length,
          sumKwh: round(sumKwh),
          minKwh: round(minKwh),
          maxKwh: round(maxKwh),
          avgKwh: round(sumKwh / entries.length)
        };
      })
        .sort((left, right) => right.bucketStart.localeCompare(left.bucketStart))
      .slice(query.offset, query.offset + query.limit);
  }

  listMeterIds(): string[] {
    return Array.from(this.store.keys()).sort((left, right) => left.localeCompare(right));
  }

  getAnalyticsSummary(query: MeterReadingAnalyticsQuery): MeterReadingAnalyticsSummary {
    const meterRows = this.buildMeterAnalyticsRows(query);
    const totalReadings = meterRows.reduce((sum, row) => sum + row.readingCount, 0);
    const totalKwh = meterRows.reduce((sum, row) => sum + row.totalKwh, 0);
    const nonNullMins = meterRows.map((row) => row.minKwh).filter((value): value is number => value !== null);
    const nonNullMaxes = meterRows.map((row) => row.maxKwh).filter((value): value is number => value !== null);

    return {
      generatedAt: new Date().toISOString(),
      meterCount: meterRows.length,
      totalReadings,
      totalKwh: round(totalKwh),
      avgReadingKwh: totalReadings > 0 ? round(totalKwh / totalReadings) : null,
      minReadingKwh: nonNullMins.length > 0 ? round(Math.min(...nonNullMins)) : null,
      maxReadingKwh: nonNullMaxes.length > 0 ? round(Math.max(...nonNullMaxes)) : null,
      meters: meterRows
    };
  }

  getTopConsumers(query: MeterReadingAnalyticsQuery, limit: number): MeterReadingAnalyticsMeterRow[] {
    return this.buildMeterAnalyticsRows(query)
      .sort((left, right) => {
        if (right.totalKwh !== left.totalKwh) {
          return right.totalKwh - left.totalKwh;
        }

        return left.meterId.localeCompare(right.meterId);
      })
      .slice(0, limit);
  }

  private buildMeterAnalyticsRows(query: MeterReadingAnalyticsQuery): MeterReadingAnalyticsMeterRow[] {
    const meterIds = query.meterIds && query.meterIds.length > 0 ? query.meterIds : this.listMeterIds();

    return meterIds
      .map((meterId) => {
        const rows = this.list({
          meterId,
          fromRecordedAt: query.fromRecordedAt,
          toRecordedAt: query.toRecordedAt,
          limit: 10000,
          offset: 0
        });

        const totalKwh = rows.reduce((sum, row) => sum + row.readingKwh, 0);
        const lastRecordedAt = rows.length > 0 ? rows[0].recordedAt : null;

        return {
          meterId,
          readingCount: rows.length,
          totalKwh: round(totalKwh),
          avgKwh: rows.length > 0 ? round(totalKwh / rows.length) : 0,
          minKwh: rows.length > 0 ? round(Math.min(...rows.map((row) => row.readingKwh))) : null,
          maxKwh: rows.length > 0 ? round(Math.max(...rows.map((row) => row.readingKwh))) : null,
          lastRecordedAt
        };
      })
      .sort((left, right) => left.meterId.localeCompare(right.meterId));
  }

  private seed(): void {
    const seedRecords: Array<IngestMeterReadingInput> = [
      {
        meterId: 'meter-abuja-001',
        readingKwh: 12.2,
        source: 'provider',
        recordedAt: '2026-07-07T08:00:00.000Z'
      },
      {
        meterId: 'meter-abuja-001',
        readingKwh: 11.8,
        source: 'provider',
        recordedAt: '2026-07-07T12:00:00.000Z'
      },
      {
        meterId: 'meter-abuja-002',
        readingKwh: 9.5,
        source: 'provider',
        recordedAt: '2026-07-07T08:00:00.000Z'
      },
      {
        meterId: 'meter-abuja-003',
        readingKwh: 7.1,
        source: 'provider',
        recordedAt: '2026-07-07T08:00:00.000Z'
      }
    ];

    for (const record of seedRecords) {
      this.ingest(record);
    }
  }
}
