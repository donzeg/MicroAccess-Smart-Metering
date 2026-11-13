-- Permanent local archive for SteamaCo readings and connectivity observations.

CREATE TABLE IF NOT EXISTS meter_reading_archive (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_meter_id TEXT NOT NULL,
  meter_number TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  interval_start TIMESTAMPTZ NULL,
  reading_kwh NUMERIC(24,9) NULL,
  usage_kwh NUMERIC(24,9) NULL,
  anomalous BOOLEAN NOT NULL DEFAULT FALSE,
  customer_provider_id TEXT NULL,
  customer_name TEXT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('utility_reading', 'meter_directive')),
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, provider_meter_id, recorded_at, source_kind),
  CHECK (reading_kwh IS NOT NULL OR usage_kwh IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_meter_reading_archive_meter_time
  ON meter_reading_archive (provider, provider_meter_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_meter_reading_archive_number_time
  ON meter_reading_archive (provider, meter_number, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_meter_reading_archive_interval
  ON meter_reading_archive (provider, provider_meter_id, interval_start DESC)
  WHERE interval_start IS NOT NULL;

CREATE TABLE IF NOT EXISTS meter_status_archive (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_meter_id TEXT NOT NULL,
  meter_number TEXT NOT NULL,
  meter_name TEXT NOT NULL,
  model TEXT NOT NULL,
  customer_provider_id TEXT NULL,
  customer_name TEXT NULL,
  connectivity TEXT NOT NULL CHECK (connectivity IN ('online', 'offline', 'never_online', 'unknown')),
  connectivity_label TEXT NOT NULL,
  last_reading_at TIMESTAMPTZ NULL,
  relay_on BOOLEAN NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, provider_meter_id, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_meter_status_archive_meter_observed
  ON meter_status_archive (provider, provider_meter_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS meter_archive_sync_runs (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  readings_observed INTEGER NOT NULL DEFAULT 0,
  readings_stored INTEGER NOT NULL DEFAULT 0,
  statuses_observed INTEGER NOT NULL DEFAULT 0,
  statuses_stored INTEGER NOT NULL DEFAULT 0,
  safe_error_code TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_meter_archive_sync_runs_started
  ON meter_archive_sync_runs (provider, started_at DESC);
