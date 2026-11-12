-- Permanent Na-Aka Hub positions and effective-dated occupant history.
-- These records are local operational data; they never mutate SteamaCo.

CREATE TABLE IF NOT EXISTS floor_positions (
  id UUID PRIMARY KEY,
  provider_customer_id TEXT NOT NULL UNIQUE,
  site_key TEXT NOT NULL,
  floor_key TEXT NOT NULL CHECK (
    floor_key IN ('ground-floor', 'first-floor', 'second-floor', 'third-floor', 'fourth-floor', 'fifth-floor', 'unclassified')
  ),
  floor_level INTEGER NULL CHECK (floor_level IS NULL OR floor_level BETWEEN 0 AND 5),
  position_label TEXT NOT NULL,
  provider_position_name TEXT NOT NULL,
  mapping_evidence TEXT NOT NULL CHECK (mapping_evidence IN ('structured_name', 'legacy_code', 'unclassified')),
  provider_tenant_snapshot TEXT NOT NULL DEFAULT '',
  provider_tenant_observed_at TIMESTAMPTZ NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_floor_positions_floor
  ON floor_positions (site_key, floor_level, position_label);

CREATE TABLE IF NOT EXISTS floor_tenancies (
  id UUID PRIMARY KEY,
  floor_position_id UUID NOT NULL REFERENCES floor_positions(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL CHECK (length(trim(tenant_name)) > 0),
  source TEXT NOT NULL CHECK (source IN ('provider_snapshot', 'management_record')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  evidence_reference TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  UNIQUE (floor_position_id, effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_floor_tenancies_one_current
  ON floor_tenancies (floor_position_id) WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_floor_tenancies_position_period
  ON floor_tenancies (floor_position_id, effective_from, effective_to);
