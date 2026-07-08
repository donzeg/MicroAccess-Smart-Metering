import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: toNumber(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  appUser: process.env.APP_USER ?? 'admin',
  appPassword: process.env.APP_PASSWORD ?? 'change-me',
  steamaEnabled: toBoolean(process.env.STEAMA_ENABLED, false),
  steamaBaseUrl: process.env.STEAMA_BASE_URL ?? 'https://api.steama.co',
  steamaTokenPath: process.env.STEAMA_TOKEN_PATH ?? '/get-token/',
  steamaUsername: process.env.STEAMA_SERVICE_USERNAME ?? '',
  steamaPassword: process.env.STEAMA_SERVICE_PASSWORD ?? '',
  steamaTimeoutMs: toNumber(process.env.STEAMA_TIMEOUT_MS, 15000),
  storageMode: process.env.STORAGE_MODE ?? 'in_memory',
  databaseUrl: process.env.DATABASE_URL ?? '',
  retryWorkerEnabled: toBoolean(process.env.RETRY_WORKER_ENABLED, true),
  retryWorkerIntervalMs: toNumber(process.env.RETRY_WORKER_INTERVAL_MS, 30000),
  retryWorkerBatchLimit: toNumber(process.env.RETRY_WORKER_BATCH_LIMIT, 20),
  retryWorkerMaxConsecutiveFailures: toNumber(process.env.RETRY_WORKER_MAX_CONSECUTIVE_FAILURES, 5),
  retryWorkerBackoffMultiplier: toNumber(process.env.RETRY_WORKER_BACKOFF_MULTIPLIER, 2),
  retryWorkerMaxIntervalMs: toNumber(process.env.RETRY_WORKER_MAX_INTERVAL_MS, 300000)
};