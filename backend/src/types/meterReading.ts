export type MeterReadingSource = 'manual' | 'sync' | 'provider';

export interface MeterReadingRecord {
  id: string;
  meterId: string;
  readingKwh: number;
  source: MeterReadingSource;
  recordedAt: string;
  ingestedAt: string;
}

export interface MeterReadingListQuery {
  meterId: string;
  fromRecordedAt?: string;
  toRecordedAt?: string;
  limit: number;
  offset: number;
}

export type MeterReadingAggregateBucket = 'hour' | 'day';

export interface MeterReadingAggregateQuery {
  meterId: string;
  bucket: MeterReadingAggregateBucket;
  fromRecordedAt?: string;
  toRecordedAt?: string;
  limit: number;
  offset: number;
}

export interface MeterReadingAggregateRow {
  meterId: string;
  bucket: MeterReadingAggregateBucket;
  bucketStart: string;
  count: number;
  sumKwh: number;
  minKwh: number;
  maxKwh: number;
  avgKwh: number;
}
