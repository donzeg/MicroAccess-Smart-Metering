import { randomUUID } from 'node:crypto';

import type {
  MeterReadingAggregateQuery,
  MeterReadingAggregateRow,
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

    return meterReadings
      .filter((entry) => {
        if (query.fromRecordedAt && entry.recordedAt < query.fromRecordedAt) {
          return false;
        }

        if (query.toRecordedAt && entry.recordedAt > query.toRecordedAt) {
          return false;
        }

        return true;
      })
      .toSorted((left, right) => right.recordedAt.localeCompare(left.recordedAt))
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
      .toSorted((left, right) => right.bucketStart.localeCompare(left.bucketStart))
      .slice(query.offset, query.offset + query.limit);
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
