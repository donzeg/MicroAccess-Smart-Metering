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

export interface MeterReadingAnalyticsQuery {
  meterIds?: string[];
  fromRecordedAt?: string;
  toRecordedAt?: string;
}

export interface MeterReadingAnalyticsMeterRow {
  meterId: string;
  readingCount: number;
  totalKwh: number;
  avgKwh: number;
  minKwh: number | null;
  maxKwh: number | null;
  lastRecordedAt: string | null;
}

export interface MeterReadingAnalyticsSummary {
  generatedAt: string;
  meterCount: number;
  totalReadings: number;
  totalKwh: number;
  avgReadingKwh: number | null;
  minReadingKwh: number | null;
  maxReadingKwh: number | null;
  meters: MeterReadingAnalyticsMeterRow[];
}
