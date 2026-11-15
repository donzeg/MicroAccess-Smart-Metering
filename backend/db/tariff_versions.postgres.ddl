-- Effective-dated retail tariff ledger. Provider observations are evidence and
-- become a new version only when all priced customer accounts agree.

CREATE TABLE IF NOT EXISTS tariff_versions (
  id UUID PRIMARY KEY,
  scope_key TEXT NOT NULL,
  tariff_band TEXT NOT NULL,
  retail_ngn_per_kwh NUMERIC(18,6) NOT NULL CHECK (retail_ngn_per_kwh > 0),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NULL,
  source TEXT NOT NULL CHECK (source IN ('msm_configuration', 'steama_observation')),
  evidence_reference TEXT NOT NULL,
  provider_customer_count INTEGER NOT NULL DEFAULT 0 CHECK (provider_customer_count >= 0),
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  UNIQUE (scope_key, effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tariff_versions_one_current
  ON tariff_versions (scope_key) WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_tariff_versions_scope_period
  ON tariff_versions (scope_key, effective_from, effective_to);
