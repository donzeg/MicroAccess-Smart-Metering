import dotenv from 'dotenv';

// Automated tests must never inherit service credentials or database settings
// from a developer's real .env file. Tests can still opt into explicit values
// (for example TEST_POSTGRES_URL) through the process environment.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toOptionalPositiveNumber = (value: string | undefined): number | null => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toIsoDate = (value: string | undefined, fallback: string): string => {
  const candidate = value?.trim() || fallback;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('MSM_COMMISSIONING_EPOCH_AT must be a valid date and time.');
  }
  return parsed.toISOString();
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallback;
};

const toMeterRegisterBaselines = (value: string | undefined): Array<{
  providerId?: string;
  meterNumber?: string;
  readingKwh: number;
  effectiveAt: string;
}> => {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not_array');
    return parsed.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('invalid_item');
      const record = item as Record<string, unknown>;
      const providerId = typeof record.providerId === 'string' ? record.providerId.trim() : '';
      const meterNumber = typeof record.meterNumber === 'string' ? record.meterNumber.trim() : '';
      const readingKwh = Number(record.readingKwh);
      const effectiveAt = typeof record.effectiveAt === 'string' ? record.effectiveAt.trim() : '';
      if (
        (!providerId && !meterNumber) ||
        !Number.isFinite(readingKwh) ||
        readingKwh < 0 ||
        !effectiveAt ||
        !Number.isFinite(new Date(effectiveAt).getTime())
      ) throw new Error('invalid_item');
      return {
        ...(providerId ? { providerId } : {}),
        ...(meterNumber ? { meterNumber } : {}),
        readingKwh,
        effectiveAt: new Date(effectiveAt).toISOString()
      };
    });
  } catch {
    throw new Error('MSM_METER_REGISTER_BASELINES_JSON must be a valid array of meter register baselines.');
  }
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  operationMode:
    process.env.MSM_OPERATION_MODE ?? (process.env.NODE_ENV === 'test' ? 'legacy_prototype' : 'phase1_read_only'),
  host: process.env.HOST ?? '0.0.0.0',
  port: toNumber(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  appUser: process.env.APP_USER ?? 'admin',
  appPassword: process.env.APP_PASSWORD ?? 'change-me',
  customerUser: process.env.CUSTOMER_USER ?? 'customer',
  customerPassword: process.env.CUSTOMER_PASSWORD ?? 'change-me-customer',
  customerId: process.env.CUSTOMER_ID ?? '1622913',
  callbackSecret: process.env.CALLBACK_SECRET ?? 'change-me-callback-secret',
  callbackToleranceSeconds: toNumber(process.env.CALLBACK_TOLERANCE_SECONDS, 300),
  authLoginLimitPerMinute: toNumber(process.env.AUTH_LOGIN_LIMIT_PER_MINUTE, 30),
  purchaseInitiateLimitPerMinute: toNumber(process.env.PURCHASE_INITIATE_LIMIT_PER_MINUTE, 60),
  callbackLimitPerMinute: toNumber(process.env.CALLBACK_LIMIT_PER_MINUTE, 120),
  managementOpsLimitPerMinute: toNumber(process.env.MANAGEMENT_OPS_LIMIT_PER_MINUTE, 120),
  readsLimitPerMinute: toNumber(process.env.READS_LIMIT_PER_MINUTE, 240),
  providerRateLimitRps: toNumber(process.env.PROVIDER_RATE_LIMIT_RPS, 10),
  retailTariffNgnPerKwh: toOptionalPositiveNumber(process.env.MSM_RETAIL_TARIFF_NGN_PER_KWH),
  retailTariffBand: process.env.MSM_RETAIL_TARIFF_BAND?.trim() || 'A',
  retailTariffEffectiveFrom: process.env.MSM_RETAIL_TARIFF_EFFECTIVE_FROM?.trim() || null,
  gridSourceIncludesGenerator: toBoolean(process.env.MSM_GRID_SOURCE_INCLUDES_GENERATOR, true),
  commissioningEpochAt: toIsoDate(
    process.env.MSM_COMMISSIONING_EPOCH_AT,
    '2025-12-31T23:00:00.000Z'
  ),
  meterRegisterBaselines: toMeterRegisterBaselines(process.env.MSM_METER_REGISTER_BASELINES_JSON),
  steamaEnabled: toBoolean(process.env.STEAMA_ENABLED, false),
  steamaBaseUrl: process.env.STEAMA_BASE_URL ?? 'https://api.steama.co',
  steamaTokenPath: process.env.STEAMA_TOKEN_PATH ?? '/get-token/',
  steamaUsername: process.env.STEAMA_SERVICE_USERNAME ?? '',
  steamaPassword: process.env.STEAMA_SERVICE_PASSWORD ?? '',
  steamaTimeoutMs: toNumber(process.env.STEAMA_TIMEOUT_MS, 15000),
  storageMode: process.env.STORAGE_MODE ?? 'in_memory',
  databaseUrl: process.env.DATABASE_URL ?? '',
  meterArchiveSyncEnabled: toBoolean(process.env.METER_ARCHIVE_SYNC_ENABLED, true),
  meterArchiveSyncIntervalMs: toNumber(process.env.METER_ARCHIVE_SYNC_INTERVAL_MS, 900000),
  meterArchiveSyncMaxIntervalMs: toNumber(process.env.METER_ARCHIVE_SYNC_MAX_INTERVAL_MS, 3600000),
  meterArchiveInitialBackfillDays: toNumber(process.env.METER_ARCHIVE_INITIAL_BACKFILL_DAYS, 3650),
  retryWorkerEnabled: toBoolean(process.env.RETRY_WORKER_ENABLED, true),
  retryWorkerIntervalMs: toNumber(process.env.RETRY_WORKER_INTERVAL_MS, 30000),
  retryWorkerBatchLimit: toNumber(process.env.RETRY_WORKER_BATCH_LIMIT, 20),
  retryWorkerMaxConsecutiveFailures: toNumber(process.env.RETRY_WORKER_MAX_CONSECUTIVE_FAILURES, 5),
  retryWorkerBackoffMultiplier: toNumber(process.env.RETRY_WORKER_BACKOFF_MULTIPLIER, 2),
  retryWorkerMaxIntervalMs: toNumber(process.env.RETRY_WORKER_MAX_INTERVAL_MS, 300000)
};
