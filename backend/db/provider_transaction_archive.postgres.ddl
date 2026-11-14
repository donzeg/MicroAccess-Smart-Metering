-- Durable, privacy-minimised archive for provider billing and payment transactions.

CREATE TABLE IF NOT EXISTS steama_transaction_archive (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('UCH', 'PAY')),
  amount NUMERIC(24,4) NOT NULL,
  account_balance NUMERIC(24,4) NULL,
  customer_provider_id TEXT NULL,
  meter_number TEXT NULL,
  reference TEXT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_steama_transaction_archive_category_time
  ON steama_transaction_archive (provider, category, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_steama_transaction_archive_customer_time
  ON steama_transaction_archive (provider, customer_provider_id, occurred_at DESC)
  WHERE customer_provider_id IS NOT NULL;

ALTER TABLE meter_archive_sync_runs
  ADD COLUMN IF NOT EXISTS transactions_observed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transactions_stored INTEGER NOT NULL DEFAULT 0;
